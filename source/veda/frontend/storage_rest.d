module veda.storage_rest;

import std.stdio, std.datetime, std.conv, std.string, std.datetime, std.file;
import core.vararg, core.stdc.stdarg;
import vibe.d, vibe.core.core, vibe.core.log, vibe.core.task, vibe.inet.mimetypes;
import properd;
import veda.pacahon_driver, veda.type, veda.core.context, veda.core.know_predicates, veda.core.define, veda.core.log_msg;
import veda.onto.onto, veda.onto.individual, veda.onto.resource, onto.lang, veda.core.util.individual8json;

// ////// logger ///////////////////////////////////////////
import util.logger;
logger _log;
logger log()
{
    if (_log is null)
        _log = new logger("veda-core-" ~ process_name, "log", "REST");
    return _log;
}
// ////// ////// ///////////////////////////////////////////


public const string veda_schema__File          = "v-s:File";
public const string veda_schema__fileName      = "v-s:fileName";
public const string veda_schema__fileSize      = "v-s:fileSize";
public const string veda_schema__fileThumbnail = "v-s:fileThumbnail";
public const string veda_schema__fileURI       = "v-s:fileURI";

const string        attachments_db_path = "./data/files";

static this() {
    Lang =
    [
        "NONE":LANG.NONE, "none":LANG.NONE,
        "RU":LANG.RU, "ru":LANG.RU,
        "EN":LANG.EN, "en":LANG.EN
    ];

    Resource_type =
    [
        "Uri":DataType.Uri,
        "String":DataType.String,
        "Integer":DataType.Integer,
        "Datetime":DataType.Datetime,
        "Decimal":DataType.Decimal,
        "Boolean":DataType.Boolean,
    ];

    try
    {
        mkdir(attachments_db_path);
    }
    catch (Exception ex)
    {
    }
}

//////////////////////////////////////////////////// Rest API /////////////////////////////////////////////////////////////////

interface VedaStorageRest_API {
    /**
     * получить для индивида список прав на ресурс.
     * Params: ticket = указывает на индивида
     *	       uri    = uri ресурса
     * Returns: JSON
     */
    @path("get_rights") @method(HTTPMethod.GET)
    Json get_rights(string ticket, string uri);

    /**
     * получить для индивида детализированный список прав на ресурс.
     * Params: ticket = указывает на индивида
     *	       uri    = uri ресурса
     * Returns: JSON
     */
    @path("get_rights_origin") @method(HTTPMethod.GET)
    Json[] get_rights_origin(string ticket, string uri);

    @path("authenticate") @method(HTTPMethod.GET)
    Ticket authenticate(string login, string password);

    @path("is_ticket_valid") @method(HTTPMethod.GET)
    bool is_ticket_valid(string ticket);

    @path("get_operation_state") @method(HTTPMethod.GET)
    long get_operation_state(int module_id);

    @path("wait_module") @method(HTTPMethod.GET)
    long wait_module(int module_id, long op_id);

    @path("set_trace") @method(HTTPMethod.GET)
    void set_trace(int idx, bool state);

    @path("backup") @method(HTTPMethod.GET)
    void backup();

    @path("count_individuals") @method(HTTPMethod.GET)
    long count_individuals();

    @path("query") @method(HTTPMethod.GET)
    string[] query(string ticket, string query, string sort = null, string databases = null, bool reopen = false, int top = 10000, int limit = 10000);

    @path("get_individuals") @method(HTTPMethod.POST)
    Json[] get_individuals(string ticket, string[] uris);

    @path("get_individual") @method(HTTPMethod.GET)
    Json get_individual(string ticket, string uri);

    @path("put_individual") @method(HTTPMethod.PUT)
    OpResult put_individual(string ticket, Json individual, bool prepare_events, string event_id);

    @path("remove_from_individual") @method(HTTPMethod.PUT)
    OpResult remove_from_individual(string ticket, Json individual, bool prepare_events, string event_id);

    @path("set_in_individual") @method(HTTPMethod.PUT)
    OpResult set_in_individual(string ticket, Json individual, bool prepare_events, string event_id);

    @path("add_to_individual") @method(HTTPMethod.PUT)
    OpResult add_to_individual(string ticket, Json individual, bool prepare_events, string event_id);

    @path("trigger") @method(HTTPMethod.PUT)
    int trigger(string ticket, string event_type, string event_id, Json individual, Json prev_state, long op_id);
}


struct Worker
{
    std.concurrency.Tid tid;
    int                 id;
    bool                ready      = true;
    bool                complete   = false;
    int                 count_busy = 0;

    // worker result data
    ResultCode          rc;
    union
    {
        string[] res_string_array;
        Json[]   res_json_array;
        long     res_long;
    }
}


class VedaStorageRest : VedaStorageRest_API
{
    private Context    context;
    private Worker *[] pool;
    string[ string ] properties;
    int                last_used_tid = 0;

    this(std.concurrency.Tid[] _pool, Context _local_context)
    {
        context = _local_context;
        foreach (idx, tid; _pool)
        {
            Worker *worker = new Worker(tid, cast(int)idx, true, false, 0, ResultCode.No_Content);
            pool ~= worker;
        }
    }

/////////////////////////////////////////////////////////////////////////////////////////////////////////////

    private std.concurrency.Tid getFreeTid()
    {
        writeln("#1 getFreeTid");
        Worker *res;
        last_used_tid++;

        if (last_used_tid >= pool.length)
            last_used_tid = 0;

        res = pool[ last_used_tid ];

        return res.tid;
    }

    private Worker *get_worker(int idx)
    {
        return pool[ idx ];
    }

    private Worker *allocate_worker()
    {
        //writeln ("@1 request worker");
        Worker *worker = get_free_worker();

        while (worker is null)
        {
            yield();
            worker = get_free_worker();
        }
        //writeln ("@2 allocate worker ", worker.id);
        worker.ready    = false;
        worker.complete = false;
        return worker;
    }

    private Worker *get_free_worker()
    {
        Worker *res = null;

        for (int idx = 0; idx < pool.length; idx++)
        {
            res = pool[ idx ];
            if (res.ready == true)
            {
                res.count_busy = 0;
                return res;
            }
            res.count_busy++;
            if (res.count_busy > 1000)
            {
                //core.thread.Thread.sleep(dur!("msecs")(100));
                //writeln ("@allocate worker, count = ", count);

                //string ppp;
                //foreach (p ; pool)
                //ppp ~= "[" ~ text (p.count_busy) ~ "]";

                //writeln ("@pool= ", ppp);
            }
        }
        //writeln ("--- ALL WORKERS BUSY ----");
        return null;
    }

    private string[] put_another_get_my(int another_worker_id, string[] another_res, ResultCode another_result_code, Worker *my_worker)
    {
        // сохраняем результат
        Worker *another_worker = get_worker(another_worker_id);

        another_worker.res_string_array = another_res;
        another_worker.rc               = another_result_code;
        another_worker.complete         = true;

        // цикл по ожиданию своего результата
        while (my_worker.complete == false)
            yield();

        string[] res = my_worker.res_string_array.dup;

        my_worker.complete = false;
        my_worker.ready    = true;

        if (my_worker.rc != ResultCode.OK)
            throw new HTTPStatusException(my_worker.rc);

        //writeln ("free worker ", my_worker.id);

        return res;
    }

    private Json[] put_another_get_my(int another_worker_id, Json[] another_res, ResultCode another_result_code,
                                      Worker *my_worker)
    {
        // сохраняем результат
        Worker *another_worker = get_worker(another_worker_id);

        another_worker.res_json_array = another_res;
        another_worker.rc             = another_result_code;
        another_worker.complete       = true;

        // цикл по ожиданию своего результата
        while (my_worker.complete == false)
            yield();

        Json[] res = my_worker.res_json_array.dup;

        my_worker.complete = false;
        my_worker.ready    = true;

        if (my_worker.rc != ResultCode.OK)
            throw new HTTPStatusException(my_worker.rc);

        //writeln ("free worker ", my_worker.id);

        return res;
    }

    private long put_another_get_my(int another_worker_id, long another_res, ResultCode another_result_code,
                                    Worker *my_worker)
    {
        // сохраняем результат
        Worker *another_worker = get_worker(another_worker_id);

        another_worker.res_long = another_res;
        another_worker.rc       = another_result_code;
        another_worker.complete = true;

        // цикл по ожиданию своего результата
        while (my_worker.complete == false)
            yield();

        long res = my_worker.res_long;

        if (my_worker.rc != ResultCode.OK)
            throw new HTTPStatusException(my_worker.rc);

        my_worker.complete = false;
        my_worker.ready    = true;

        return res;
    }

/////////////////////////////////////////////////////////////////////////////////////////////////////////////

    void fileManager(HTTPServerRequest req, HTTPServerResponse res)
    {
        //writeln("@v req.path=", req.path);

        string uri;
        // uri субьекта

        long pos = lastIndexOf(req.path, "/");

        if (pos > 0)
        {
            uri = req.path[ pos + 1..$ ];
        }
        else
            return;

        // найдем в хранилище указанного субьекта

        //writeln("@v uri=", uri);

        string _ticket = req.cookies.get("ticket", "");

        //writeln("@v ticket=", _ticket);

        if (uri.length > 3 && _ticket !is null)
        {
            Ticket     *ticket = context.get_ticket(_ticket);

            Individual file_info;

            ResultCode rc = ticket.result;
            if (rc == ResultCode.OK)
            {
                file_info = context.get_individual(ticket, uri);

                //writeln("@v file_info=", file_info);
                auto fileServerSettings = new HTTPFileServerSettings;
                fileServerSettings.encodingFileExtension = [ "jpeg":".JPG" ];

                string path     = file_info.getFirstResource("v-s:filePath").get!string;
                string file_uri = file_info.getFirstResource("v-s:fileUri").get!string;

                if (path !is null && file_uri !is null && file_uri.length > 0)
                {
                    if (path.length > 0)
                        path = path ~ "/";

                    string full_path = attachments_db_path ~ "/" ~ path ~ file_uri;

                    enforce(exists(full_path), "No file found!");

                    HTTPServerRequestDelegate dg =
                        serveStaticFile(full_path, fileServerSettings);

                    string originFileName = file_info.getFirstResource(veda_schema__fileName).get!string;

                    //writeln("@v originFileName=", originFileName);
                    //writeln("@v getMimeTypeForFile(originFileName)=", getMimeTypeForFile(originFileName));

                    res.headers[ "Content-Disposition" ] = "attachment; filename=\"" ~ originFileName ~ "\"";

                    res.contentType = getMimeTypeForFile(originFileName);
                    dg(req, res);
                }
            }
        }
    }

    override :

    Json get_rights(string _ticket, string uri)
    {
        ResultCode rc;
        ubyte      res;

        Ticket     *ticket = context.get_ticket(_ticket);

        rc = ticket.result;
        if (rc == ResultCode.OK)
        {
            res = context.get_rights(ticket, uri);
        }

        Individual indv_res;
        indv_res.uri = "_";

        indv_res.addResource(rdf__type, Resource(DataType.Uri, veda_schema__PermissionStatement));

        if ((res & Access.can_read) > 0)
            indv_res.addResource(veda_schema__canRead, Resource(true));

        if ((res & Access.can_update) > 0)
            indv_res.addResource(veda_schema__canUpdate, Resource(true));

        if ((res & Access.can_delete) > 0)
            indv_res.addResource(veda_schema__canDelete, Resource(true));

        if ((res & Access.can_create) > 0)
            indv_res.addResource(veda_schema__canCreate, Resource(true));


        Json json = individual_to_json(indv_res);
        return json;
    }

    Json[] get_rights_origin(string ticket, string uri)
    {
        immutable(Individual)[] individuals;
        //Tid                     my_task = Task.getThis();

        //if (my_task !is Tid.init)
        {
            std.concurrency.send(getFreeTid(), Command.Get, Function.RightsOrigin, uri, ticket, std.concurrency.thisTid);
            //yield();
            individuals = std.concurrency.receiveOnly!(immutable(Individual)[]);
        }

        Json[] json = Json[].init;
        foreach (individual; individuals)
            json ~= individual_to_json(individual);

        return json;
    }

    Ticket authenticate(string login, string password)
    {
        Ticket ticket = context.authenticate(login, password);

        if (ticket.result != ResultCode.OK)
            throw new HTTPStatusException(ticket.result);
        return ticket;
    }

    long get_operation_state(int module_id)
    {
        return context.get_operation_state(cast(P_MODULE)module_id);
    }

    long wait_module(int module_id, long op_id)
    {
        long res = context.wait_thread(cast(P_MODULE)module_id, op_id);

        return res;
    }

    void set_trace(int idx, bool state)
    {
        context.set_trace(idx, state);
    }

    void backup()
    {
        ResultCode rc = ResultCode.OK;
        int        recv_worker_id;

        long       res = -1;

        Worker     *worker = allocate_worker();

        std.concurrency.send(getFreeTid(), Command.Execute, Function.Backup, worker.id, std.concurrency.thisTid);
        yield();
        std.concurrency.receive((bool _res, int _recv_worker_id) { res = _res; recv_worker_id = _recv_worker_id; });

        if (recv_worker_id == worker.id)
        {
            worker.complete = false;
            worker.ready    = true;

            if (rc != ResultCode.OK)
                throw new HTTPStatusException(rc);
        }
        else
        {
            res = put_another_get_my(recv_worker_id, res, rc, worker);
        }
        return;
    }

    long count_individuals()
    {
        ResultCode rc = ResultCode.OK;
        int        recv_worker_id;

        long       res = -1;

        Worker     *worker = allocate_worker();

        std.concurrency.send(worker.tid, Command.Execute, Function.CountIndividuals, worker.id, std.concurrency.thisTid);
        yield();
        std.concurrency.receive((long _res, int _recv_worker_id) { res = _res; recv_worker_id = _recv_worker_id; });

        if (recv_worker_id == worker.id)
        {
            worker.complete = false;
            worker.ready    = true;

            if (rc != ResultCode.OK)
                throw new HTTPStatusException(rc);
        }
        else
        {
            res = put_another_get_my(recv_worker_id, res, rc, worker);
        }
        return res;
    }

    bool is_ticket_valid(string ticket)
    {
        bool res = context.is_ticket_valid(ticket);

        return res;
    }

    string[] query(string ticket, string _query, string sort = null, string databases = null, bool reopen = false, int top = 10000, int limit = 10000)
    {
        StopWatch sw; sw.start;

        try
        {
            ResultCode rc;
            int        recv_worker_id;

            string[]   individuals_ids;

            Worker     *worker = allocate_worker();

            std.concurrency.send(worker.tid, Command.Get, Function.IndividualsIdsToQuery, _query, sort, databases, ticket, reopen,
                                 top, limit, worker.id, std.concurrency.thisTid);

            yield();

            std.concurrency.receive((immutable(
                                               string)[] _individuals_ids, ResultCode _rc, int _recv_worker_id)
                                    { individuals_ids = cast(string[])_individuals_ids;
                                      rc = _rc; recv_worker_id =
                                          _recv_worker_id; });

            if (recv_worker_id == worker.id)
            {
                worker.complete = false;
                worker.ready    = true;

                if (rc != ResultCode.OK)
                    throw new HTTPStatusException(rc);
            }
            else
            {
                individuals_ids = put_another_get_my(recv_worker_id, individuals_ids, rc, worker);
            }
            return individuals_ids;
        }
        finally
        {
            context.stat(CMD.GET, sw);
        }
    }

    Json[] get_individuals(string ticket, string[] uris)
    {
        ResultCode rc;
        int        recv_worker_id;

        Json[]     res;

        Worker     *worker = allocate_worker();

        std.concurrency.send(worker.tid, Command.Get, Function.Individuals, uris.idup, ticket, worker.id, std.concurrency.thisTid);
        yield();
        std.concurrency.receive((immutable(
                                           Json)[] _res, ResultCode _rc, int _recv_worker_id) { res = cast(Json[])_res; rc = _rc;
                                                                                                recv_worker_id =
                                                                                                    _recv_worker_id; });

        if (recv_worker_id == worker.id)
        {
            worker.complete = false;
            worker.ready    = true;

            if (rc != ResultCode.OK)
                throw new HTTPStatusException(rc);
        }
        else
        {
            res = put_another_get_my(recv_worker_id, res, rc, worker);
        }

        return res;
    }

    Json get_individual(string _ticket, string uri)
    {
        StopWatch sw; sw.start;

        try
        {
            if (trace_msg[ 500 ] == 1)
                log.trace("get_individual #start : %s ", uri);

            ResultCode rc;
            int        recv_worker_id;

            Json[]     res;

            Worker     *worker = allocate_worker();

            std.concurrency.send(worker.tid, Command.Get, Function.Individual, uri, "", _ticket, worker.id, std.concurrency.thisTid);
            yield();
            std.concurrency.receive((immutable(
                                               Json)[] _res, ResultCode _rc, int _recv_worker_id) { res = cast(Json[])_res; rc = _rc;
                                                                                                    recv_worker_id = _recv_worker_id; });

            if (recv_worker_id == worker.id)
            {
                //writeln ("free worker ", worker.id);
                worker.complete = false;
                worker.ready    = true;

                if (rc != ResultCode.OK)
                {
                    if (trace_msg[ 500 ] == 1)
                        log.trace("get_individual #!ERR : %s ", text(rc));

                    throw new HTTPStatusException(rc);
                }
            }
            else
            {
                res = put_another_get_my(recv_worker_id, res, rc, worker);
            }

            if (trace_msg[ 500 ] == 1)
                log.trace("get_individual #end : %s, res.length=%d", text(rc), res.length);

            if (res.length > 0)
                return res[ 0 ];
            else
                return Json.init;
        }
        finally
        {
            context.stat(CMD.GET, sw);
            if (trace_msg[ 25 ] == 1)
                log.trace("get_individual: end, uri=%s", uri);
        }
    }

    OpResult put_individual(string _ticket, Json individual_json, bool prepare_events, string event_id)
    {
        OpResult res;

        long     count_prep_put = search.xapian_indexer.get_count_prep_put();
        long     count_recv_put = search.xapian_indexer.get_count_recv_put();

        if (count_recv_put - count_prep_put > 1000)
            throw new HTTPStatusException(ResultCode.Too_Many_Requests);

        Ticket     *ticket = context.get_ticket(_ticket);

        ResultCode rc = ticket.result;

        if (rc == ResultCode.OK)
        {
            Individual indv = json_to_individual(individual_json);
            res = context.put_individual(ticket, indv.uri, indv, prepare_events, event_id == "" ? null : event_id);
        }

        if (res.result != ResultCode.OK)
            throw new HTTPStatusException(res.result);

        return res;
    }

    OpResult add_to_individual(string _ticket, Json individual_json, bool prepare_events, string event_id)
    {
        Ticket     *ticket = context.get_ticket(_ticket);

        OpResult   res;
        ResultCode rc = ticket.result;

        if (rc == ResultCode.OK)
        {
            Individual indv = json_to_individual(individual_json);
            res = context.add_to_individual(ticket, indv.uri, indv, prepare_events, event_id == "" ? null : event_id);
        }

        if (res.result != ResultCode.OK)
            throw new HTTPStatusException(rc);

        return res;
    }

    OpResult set_in_individual(string _ticket, Json individual_json, bool prepare_events, string event_id)
    {
        Ticket     *ticket = context.get_ticket(_ticket);

        OpResult   res;
        ResultCode rc = ticket.result;

        if (rc == ResultCode.OK)
        {
            Individual indv = json_to_individual(individual_json);
            res = context.set_in_individual(ticket, indv.uri, indv, prepare_events, event_id == "" ? null : event_id);
        }

        if (res.result != ResultCode.OK)
            throw new HTTPStatusException(rc);

        return res;
    }

    OpResult remove_from_individual(string _ticket, Json individual_json, bool prepare_events, string event_id)
    {
        Ticket     *ticket = context.get_ticket(_ticket);

        OpResult   res;
        ResultCode rc = ticket.result;

        if (rc == ResultCode.OK)
        {
            Individual indv = json_to_individual(individual_json);
            res = context.remove_from_individual(ticket, indv.uri, indv, prepare_events, event_id == "" ? null : event_id);
        }

        if (res.result != ResultCode.OK)
            throw new HTTPStatusException(rc);

        return res;
    }

    int trigger(string _ticket, string event_type, string event_id, Json individual_json, Json prev_state_json, long op_id)
    {
        //writeln ("REST: trigger #1 ", "op_id=", op_id, " *", process_name);
        Ticket     *ticket = context.get_ticket(_ticket);

        ResultCode rc = ticket.result;

        if (rc == ResultCode.OK)
        {
            Individual indv = json_to_individual(individual_json);

            EVENT      ev_type;

            if (event_type == "UPDATE")
                ev_type = EVENT.UPDATE;
            else if (event_type == "CREATE")
                ev_type = EVENT.CREATE;
            else if (event_type == "REMOVE")
                ev_type = EVENT.REMOVE;

            Individual prev_state_indv;
            if (prev_state_json != Json.init)
                prev_state_indv = json_to_individual(individual_json);

            veda.core.bus_event.trigger_script(ticket, ev_type, &indv, &prev_state_indv, context, event_id, op_id);

            rc = ResultCode.OK;
        }
        if (rc != ResultCode.OK)
        {
            throw new HTTPStatusException(rc);
        }
        //writeln ("REST: trigger #e ", "op_id=", op_id, " *", process_name);

        return rc.to!int;
    }
}
