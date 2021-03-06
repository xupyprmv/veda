// Server-side utility functions
"use strict";

/// Создание
var can_create = 1;

/// Чтение
var can_read = 2;

/// Изменеие
var can_update = 4;

/// Удаление
var can_delete = 8;

/// Запрет создания
var cant_create = 16;

/// Запрет чтения
var cant_read = 32;

/// Запрет обновления
var cant_update = 64;

/// Запрет удаления
var cant_delete = 128;

function toJson(x)
{
    return JSON.stringify(x, null, 2);
}

function newDocument(type, fields)
{

}

function newUri(uri)
{
    return [
    {
        data: uri,
        type: _Uri
    }];
}

function newStr(_data)
{
    return [
    {
        data: _data,
        type: _String,
        lang: 0
    }];
}

function newBool(_data)
{
    return [
    {
        data: _data,
        type: _Bool
    }];
}

function newDate(_data)
{
    return [
    {
        data: _data,
        type: _Datetime
    }];
}

function addDay(_data, _days)
{
    if (!_data)
        _data = new Date();

    try
    {
        _data.setDate(_data.getDate() + _days);
    }
    catch (e)
    {
        print(e);
    }

    return _data;
}

function getStrings(field)
{
    var res = [];
    if (field)
    {
        for (var i in field)
        {
            res.push(field[i].data);
        }
    }
    return res;
}

function getUris(field)
{
    var res = [];
    if (field)
    {
        for (var i in field)
        {
            res.push(field[i].data);
        }
    }
    return res;
}

function getUri(field)
{
    if (field && field.length > 0)
    {
        return field[0].data;
    }
}

function getFirstValue(field)
{
    if (field && field.length > 0)
    {
        if (field[0].type == _Integer)
        {
            return parseInt(field[0].data, 10);
        }
        else if (field[0].type == _Datetime)
            return new Date(field[0].data);

        return field[0].data;
    }
}

function addRight(ticket, rights, subj_uri, obj_uri)
{
    var c = false,
        r = false,
        d = false,
        u = false;

    for (var i = 0; i < rights.length; i++)
    {
        if (rights[i] == can_read)
            r = true;
        else if (rights[i] == can_update)
            u = true;
        else if (rights[i] == can_delete)
            d = true;
        else if (rights[i] == can_create)
            c = true;
    }

    var new_permission = {
        '@': genUri(),
        'rdf:type': [
        {
            data: 'v-s:PermissionStatement',
            type: _Uri
        }],
        'v-s:canDelete': [
        {
            data: d,
            type: _Bool
        }],
        'v-s:canRead': [
        {
            data: r,
            type: _Bool
        }],
        'v-s:canUpdate': [
        {
            data: u,
            type: _Bool
        }],
        'v-s:permissionObject': [
        {
            data: obj_uri,
            type: _Uri
        }],
        'v-s:permissionSubject': [
        {
            data: subj_uri,
            type: _Uri
        }]
    };
    put_individual(ticket, new_permission, _event_id);

    //print("ADD RIGHT:", toJson(new_permission));
}

/////////////////////////////////////// JOURNAL

function getJournalUri(object_uri)
{
    return object_uri + "j";
}

function getTraceJournalUri(object_uri)
{
    return object_uri + "t";
}

function newJournalRecord(journal_uri)
{
    var new_journal_record_uri = genUri();

    var new_journal_record = {
        '@': new_journal_record_uri,
        'rdf:type': [
        {
            data: 'v-s:JournalRecord',
            type: _Uri
        }],
        'v-s:parentJournal': [
        {
            data: journal_uri,
            type: _Uri
        }],
        'v-s:created': [
        {
            data: new Date(),
            type: _Datetime
        }]
    };
    return new_journal_record;
}

function logToJournal(ticket, journal_uri, journal_record, jr_type)
{
	//if (!jr_type)
	//	print("@@@ logToJournal, new_journal_record=" + toJson(journal_record));
	
    put_individual(ticket, journal_record, _event_id);

    var add_to_journal = {
        '@': journal_uri,
        'v-s:childRecord': [
        {
            data: journal_record['@'],
            type: _Uri
        }]
    };

	//if (!jr_type)
	//	print("@@@ logToJournal, add_to_journal = " + toJson(add_to_journal));

    var before = get_individual(ticket, journal_uri);
    print('BEFORE : '+toJson(before))
	
    add_to_individual(ticket, add_to_journal, _event_id);
    
    var after = get_individual(ticket, journal_uri);
    print('AFTER : '+toJson(after))
}

function traceToJournal(ticket, journal_uri, label, _data)
{
    //print("@@@ traceToJournal, journal_uri=" + journal_uri + " #1");
    var journal_record = newJournalRecord(journal_uri);

    journal_record['rdf:type'] = [
    {
        data: 'v-wf:TraceRecord',
        type: _Uri
    }];
    journal_record['rdfs:label'] = [
    {
        data: label,
        type: _String
    }];
    journal_record['rdfs:comment'] = [
    {
        data: _data,
        type: _String
    }];

    logToJournal(ticket, journal_uri, journal_record, true);

    //print("@@@ traceToJournal, journal_uri=" + journal_uri + ", " + toJson(journal_record));
}

function isTecnicalChange(newdoc, olddoc) {
	if (newdoc['v-s:actualVersion'] && newdoc['v-s:actualVersion'][0].data != newdoc['@']) {
		olddoc = get_individual(ticket, newdoc['v-s:actualVersion'][0].data);
	}
	if (!olddoc) return false;

	for (var key in newdoc) {
		if (key === '@') continue;
		
		if ((newdoc[key] && !olddoc[key])  // добвили
		     || (newdoc[key] && !olddoc[key]) // удалили
		     || (newdoc[key].length !== olddoc[key].length) // изменили количество
		    ) 
		{ 	
			if (!isTechnicalAttribute(key)) {
				// в нетехническом атрибуте
				return false;				
			}
		} else {
			for (var item in newdoc[key]) {
				if (newdoc[key][item].data.valueOf() != olddoc[key][item].data.valueOf() && !isTechnicalAttribute(key)) { // поменялось одно из значений в нетехническом атрибуте
					return false;		
				} 
			}
		}
	}
	
	return true;
}

function isTechnicalAttribute(attName) {
//	if (attName === 'v-s:actualVersion') return true;
//	if (attName === 'v-s:previousVersion') return true;
//	if (attName === 'v-s:nextVersion') return true;
	if (attName === 'v-s:isDraftOf') return true;
	if (attName === 'v-s:hasDraft') return true;
	if (attName === 'v-s:hasStatusWorkflow') return true;
	return false;
}
