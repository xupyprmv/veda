/**
 * @class jsWorkflow.Instance
 * 
 * Net editor. Used to create / modify / view workflow nets.
 * 
 * Inspired by [http://github.com/hemantsshetty/jsWorkflow][1]
 * 
 * [1]: http://github.com/hemantsshetty/jsWorkflow
 */
var jsWorkflow = jsWorkflow || {};

// Leveraging the ready function of jsPlumb.
jsWorkflow.ready = jsPlumb.ready;

// Self execute this code
(function() {
	
    // No API call should be made until the DOM has been initialized.
    jsWorkflow.ready(function() {
        /**
         *Create a workflow instance.
         *@constructor Instance
         */
        jsWorkflow.Instance = function() {

            // Get a new instance of jsPlumb.
            this.instance = jsPlumb.getInstance();
        };
        
        /**
         *Initialize the workflow instance.
         *@method init
         *@param {String} workflowData Id of an HTML container within which the worlflow is to be rendered
         *@param {Object} veda global "veda" instance
         *@param {veda.IndividualModel} net individual of rdfs:type "v-wf:Net"
         *return {Object} instance Returns an initialized instance of the workflow object
         */
        jsWorkflow.Instance.prototype.init = function(workflowData, veda, net, template, container) {
			net.prefetch(3);
            var 	instance,
                    windows,
                    addNewState,
                    bindStateEvents,
                    workflow,
                    canvasSizePx=10000,
                    elementId,
                    selectedElementId,
                    selectedElementType,
                    selectedElementSourceId,                    
                    process,
                    mode='view',
                    max_process_depth=0,
                    
           			props = $("#props", template),
					propsHead = $("#props-head", template);
            
            if (net.hasValue('rdf:type')) {
            	if (net['rdf:type'][0].id == 'v-wf:Net') {
            		mode='edit';
            		elementId = net.id;
            	}
            	if (net['rdf:type'][0].id == 'v-wf:Process') {
            		mode='view';
            		process = net;
            		net = (net.hasValue('v-wf:instanceOf'))?net['v-wf:instanceOf'][0]:[];            		
            		elementId = net.id;
            	}
            }

            if (typeof workflowData === 'object') {
                workflow = workflowData.container;
                jsWorkflow.Instance.createWorkflowDOM(workflowData);
            } else {
                workflow = workflowData;
            }
            net['offsetX'] = veda["workflow"+elementId+"-offsetX"];
            net['offsetY'] = veda["workflow"+elementId+"-offsetY"];
            net['currentScale'] = veda["workflow"+elementId+"-zoom"];
            if (net['currentScale']==null) net['currentScale'] = 1.0;
            
            if (!net['offsetX']) {
            	net['offsetX'] = 0;
            }
            if (!net['offsetY']) {
            	net['offsetY'] = 0;
            }
            
            if (mode === "view") {
				var holder = $("<div>");
				propsHead.text(net["rdfs:label"].join(", "));
				process.present(holder, new veda.IndividualModel("v-wf:ProcessPropsTemplate"));
				props.empty().append(holder);
			}
            
            $('#'+workflowData).css({
       			'height': canvasSizePx +'px',
       			'width': canvasSizePx+'px'
       		});
        	$('.workflow-wrapper').addClass('calculated-height');
        	$('#'+workflowData).draggable({
                drag: function (event, ui) {
                  instance.moveCanvas(ui.position.left, ui.position.top);	
              	  $("#workflow-context-menu").hide();
                }
            }).on("click", function() {
            	instance.defocus();
            	if (mode === "view") {
					var holder = $("<div>");
					propsHead.text(net["rdfs:label"].join(", "));
					process.present(holder, new veda.IndividualModel("v-wf:ProcessPropsTemplate"));
					props.empty().append(holder);
				}
            	if (mode === "edit") {
					var holder = $("<div>");
					propsHead.text(net["rdfs:label"].join(", "));
					net.present(holder, new veda.IndividualModel("v-wf:SimpleNetTemplate"), 'edit');
					props.empty().append(holder);
				}            	
            });

            instance = this.instance;

            // Import all the given defaults into this instance.
            instance.importDefaults({
                Endpoint: "Dot",
                HoverPaintStyle: {
                    strokeStyle: "#6699FF",
                    lineWidth: 1
                },
                ConnectionOverlays: [
                    ["Arrow", {
                            location: 1,
                            id: "arrow",
                            length: 14,
                            width: 10,
                            foldback: 0.8
                        }],
                    ["Label", {
                            label: "transition",
                            id: "label",
                            cssClass: "aLabel"
                        }]
                ],
                Container: workflow // Id of the workflow container.
            });
            
            instance.moveCanvas = function (newLeft, newTop) {
            	//DEBUG $('#workflow-net-name').text(newLeft+" / "+newTop); 
            	
            	// change scale and offset
                $('#'+workflowData).css({
           			'left': (newLeft)+'px',
           			'top': (newTop)+'px',
           		});
                veda["workflow"+elementId+"-offsetX"] = newLeft;
                veda["workflow"+elementId+"-offsetY"] = newTop;
                net['offsetX'] = newLeft;
                net['offsetY'] = newTop;
            }
            if (net['offsetX']!=null && net['offsetX']!=0) {
            	instance.moveCanvas(net['offsetX'], net['offsetY']);
            } else {
                instance.moveCanvas(-canvasSizePx/2, -canvasSizePx/2);
            }

            // Bind a click listener to each transition (connection). On double click, the transition is deleted.
            if (mode=='edit') {
	            instance.bind("dblclick", function(transition) {
	                var _this = this;
	            	riot.route("#/" + transition.id + "///edit", true);
	            });
            }
            
            // Fill info panel on flow click
            instance.bind("click", function(transition) {            	
            	var _this = this;
            	veda["workflow"+elementId+"-selectedElement"] = _this.id;
            	instance.defocus();
                
                transition.setPaintStyle({strokeStyle: "#FF0000"});

                if (transition.id == '__label') {
                	transition = transition.component;
                }
                
                selectedElementId =  transition.id;
                selectedElementType = 'flow';
                selectedElementSourceId = transition.sourceId;
                
            	var about = new veda.IndividualModel(transition.id);
            	var holder = $("<div>");
            	if (about['rdf:type'][0].id == 'v-wf:') 
            	{
            		about.present(holder, new veda.IndividualModel("v-wf:FlowTemplateAsProperties"), 'edit');
            	} else {
            		about.present(holder);
            	}
            	props.append(holder);
            	if ( about.hasValue("rdfs:label") ) propsHead.text(about["rdfs:label"].join(", "));
            	else propsHead.text(about.id);
            });
            
            instance.bind("connectionMoved", function(info, originalEvent) {
            	if (info.originalSourceId !== info.newSourceId) {
	            	net['v-wf:consistsOf'].forEach(function(state) {
	        			if (state.id === info.originalSourceId) {
	        				state['v-wf:hasFlow'] = veda.Util.removeSubIndividual(state, 'v-wf:hasFlow', info.connection.id);            				
	        			}
	        			if (state.id === info.newSourceId) {
	        				state['v-wf:hasFlow'] = state.hasValue('v-wf:hasFlow')? state['v-wf:hasFlow'].concat([new veda.IndividualModel(info.connection.id)]):[new veda.IndividualModel(info.connection.id)];            				
	        			}
	        		});            
            	}
            });
            
            // Handle creating new flow event
            instance.bind("connection", function(info) {
            	if (info.connection.id.indexOf('con')==-1) {
            		var flow = new veda.IndividualModel(info.connection.id);
          	    	flow["v-wf:flowsInto"] = [new veda.IndividualModel(info.targetId)]; // setup Flow target
            		return; // Don't use logic when we work with flows that already exists
            	}
                var individual = new veda.IndividualModel(); // create individual (Task / Condition) 
                individual.defineProperty("rdf:type");
                individual.defineProperty("rdfs:label");                
                individual.defineProperty("v-wf:flowsInto");
                
                individual["rdf:type"] = [veda.ontology["v-wf:Flow"]];
                individual["rdfs:label"] = [new String('')];
                
                net['v-wf:consistsOf'] = net['v-wf:consistsOf'].concat([individual]); // <- Add new Flow to Net
                
                var source = new veda.IndividualModel(info.sourceId);
                if (!source.hasOwnProperty('v-wf:hasFlow')) {
                	source.defineProperty('v-wf:hasFlow');
    			}
                source['v-wf:hasFlow'] = source['v-wf:hasFlow'].concat([individual]);
                
              	individual["v-wf:flowsInto"] = [new veda.IndividualModel(info.targetId)]; // setup Flow target
                
                info.connection.id = individual.id;
            });

            subNetViewButton = function(state, $state) {
            	if (!state.hasValue('v-wf:subNet')) {
            		return;
            	}
            	$("<span/>", {
            		"click": (function (instance) {
            	    	riot.route('#/'+state['v-wf:subNet'][0].id+'///edit', true);
            		 }),
            		 "class" : "glyphicon glyphicon-search subnet-link"
             	}).appendTo($state);
            };
            
            executorMark = function(state, $state) {
            	if (!state.hasValue('v-wf:executor')) {
            		return;
            	}
            	if (state['v-wf:executor'][0]['rdf:type'][0].id == 'v-s:Appointment') {
	            	$("<span/>", {
	            		 "class" : "glyphicon glyphicon-user"
	             	}).appendTo($state);
            	} else {
	            	$("<span/>", {
	            		 "class" : "glyphicon glyphicon-cog"
	             	}).appendTo($state);
            	}
            };
            
            instance.updateSVGBackground = function(item) {
                var svgBackground = "";
                if (item.hasClass('split-and')) {
                    svgBackground += "<line x1='80' y1='25' x2='100' y2='0' style='stroke:rgb(0,0,0); stroke-width:1' /><line x1='80' y1='0' x2='80' y2='50' style='stroke:rgb(0,0,0); stroke-width:1' /><line x1='80' y1='25' x2='100' y2='50' style='stroke:rgb(0,0,0); stroke-width:1' />";
                }
                if (item.hasClass('split-or')) {
                    svgBackground += "<line x1='100' y1='25' x2='90' y2='0' style='stroke:rgb(0,0,0); stroke-width:1' /><line x1='90' y1='0' x2='80' y2='25' style='stroke:rgb(0,0,0); stroke-width:1' /><line x1='80' y1='0' x2='80' y2='50' style='stroke:rgb(0,0,0); stroke-width:1' /><line x1='100' y1='25' x2='90' y2='50' style='stroke:rgb(0,0,0); stroke-width:1' /><line x1='90' y1='50' x2='80' y2='25' style='stroke:rgb(0,0,0); stroke-width:1' />";
                }
                if (item.hasClass('split-xor')) {
                    svgBackground += "<line x1='100' y1='25' x2='80' y2='0' style='stroke:rgb(0,0,0); stroke-width:1' /><line x1='80' y1='0' x2='80' y2='50' style='stroke:rgb(0,0,0); stroke-width:1' /><line x1='100' y1='25' x2='80' y2='50' style='stroke:rgb(0,0,0); stroke-width:1' />";
                }
                if (item.hasClass('join-and')) {
                    svgBackground += "<line x1='20' y1='25' x2='0' y2='0' style='stroke:rgb(0,0,0); stroke-width:1' /><line x1='20' y1='0' x2='20' y2='50' style='stroke:rgb(0,0,0); stroke-width:1' /><line x1='20' y1='25' x2='0' y2='50' style='stroke:rgb(0,0,0); stroke-width:1' />";
                }
                if (item.hasClass('join-or')) {
                    svgBackground += "<line x1='0' y1='25' x2='10' y2='0' style='stroke:rgb(0,0,0); stroke-width:1' /><line x1='10' y1='0' x2='20' y2='25' style='stroke:rgb(0,0,0); stroke-width:1' /><line x1='20' y1='0' x2='20' y2='50' style='stroke:rgb(0,0,0); stroke-width:1' /><line x1='0' y1='25' x2='10' y2='50' style='stroke:rgb(0,0,0); stroke-width:1' /><line x1='10' y1='50' x2='20' y2='25' style='stroke:rgb(0,0,0); stroke-width:1' />";
                }
                if (item.hasClass('join-xor')) {
                    svgBackground += "<line x1='0' y1='25' x2='20' y2='0' style='stroke:rgb(0,0,0); stroke-width:1' /><line x1='20' y1='0' x2='20' y2='50' style='stroke:rgb(0,0,0); stroke-width:1' /><line x1='0' y1='25' x2='20' y2='50' style='stroke:rgb(0,0,0); stroke-width:1' />";
                }
                svgBackground = "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' version='1.1' preserveAspectRatio='none' viewBox='0 0 100 50'>" + svgBackground + "</svg>\")";
                item.css('background', svgBackground);
            };
            
            instance.showProcessRunPath = function(workItem, depth) {
            	if (workItem.hasValue('v-wf:previousWorkItem')) {
            		workItem['v-wf:previousWorkItem'].forEach(function(previousWorkItem) {
            			if (workItem.hasValue('v-wf:forNetElement') && previousWorkItem.hasValue('v-wf:forNetElement')) {
            				instance.showProcessRunPath(previousWorkItem, depth+1);
            				instance.select({target:workItem['v-wf:forNetElement'][0].id, source:previousWorkItem['v-wf:forNetElement'][0].id}).each(function(e) {
            					e.addClass('process-path-highlight');
            					var pathCounterLabel = (e.getOverlay("pathCounter")!=undefined)?e.getOverlay("pathCounter").getLabel():'';
            					e.removeOverlay("pathCounter");
                        		e.addOverlay(["Label", { label: ((pathCounterLabel!='')?pathCounterLabel+',':'')+(max_process_depth-depth), location:0.5, id: "pathCounter", cssClass:'pathCounterLabel'} ]);            					
            				});
            			}
            		});
            	} else {
            		max_process_depth = depth;
            	}
            };
            
            instance.addVarProperty = function(stateId, mapping, varId) {
            	var variable = new veda.IndividualModel(varId);
                
                var individualM = new veda.IndividualModel(); // create individual (Mapping)
                
                individualM.defineProperty("rdf:type");
                individualM.defineProperty("v-wf:mapsTo");
                individualM.defineProperty("v-wf:mappingExpression");
                
           		individualM["rdf:type"] = [veda.ontology["v-wf:Mapping"]];
           		individualM["v-wf:mapToVariable"] = [variable];
                individualM['v-wf:mappingExpression'] = ["process.getInputVariable ('"+variable["v-wf:varDefineName"][0]+"')"];
                
                veda.Util.forSubIndividual(net, 'v-wf:consistsOf', stateId, function (state) {
                	state[mapping] = state[mapping].concat([individualM]); // <- Add new Mapping to State
                });
            }
            
            /**
             *Bind required functional to State elements
             *@method bindStateEvents
             *@param {Object} windows List of all State elements
             */
            bindStateEvents = function(windows) {
                windows.find('.state-name').droppable({
                	hoverClass: 'dragHover',
                	drop: function( event, ui ) {
                		var varId = ui.draggable.attr('resource');
                		var taskId = windows.attr('id');
                		var $div = $("<div />");
                		$div.appendTo($('#main'));
            			$div.dialog({
            				modal: true,
            				resizable: false,
            				buttons: {
            					"v-wf:startingMapping": function() {
            						instance.addVarProperty(taskId, "v-wf:startingMapping", varId);
            						$(this).dialog("close");
            						$('#'+veda.Util.escape4$(taskId)).trigger("click");
            					},
            					"v-wf:completedMapping": function() {
            						instance.addVarProperty(taskId, "v-wf:completedMapping", varId);
            						$(this).dialog("close");
            						$('#'+veda.Util.escape4$(taskId)).trigger("click");
            					},
            					"v-wf:wosResultsMapping": function() {
            						instance.addVarProperty(taskId, "v-wf:wosResultsMapping", varId);
            						$(this).dialog("close");
            						$('#'+veda.Util.escape4$(taskId)).trigger("click");
            					},
            					"v-wf:startingJournalMap": function() {
            						instance.addVarProperty(taskId, "v-wf:startingJournalMap", varId);
            						$(this).dialog("close");
            						$('#'+veda.Util.escape4$(taskId)).trigger("click");
            					},
            					"v-wf:completedJournalMap": function() {
            						instance.addVarProperty(taskId, "v-wf:completedJournalMap", varId);
            						$(this).dialog("close");
            						$('#'+veda.Util.escape4$(taskId)).trigger("click");
            					},
            					"v-wf:startingExecutorJournalMap": function() {
            						instance.addVarProperty(taskId, "v-wf:startingExecutorJournalMap", varId);
            						$(this).dialog("close");
            						$('#'+veda.Util.escape4$(taskId)).trigger("click");
            					},
            					"v-wf:completedExecutorJournalMap": function() {
            						instance.addVarProperty(taskId, "v-wf:completedExecutorJournalMap", varId);
            						$(this).dialog("close");
            						$('#'+veda.Util.escape4$(taskId)).trigger("click");
            					}
            				}
            			});                		
                    }
                });
            	
                windows.bind("click", function(e) {
                    var _this = this, currentElement = $(_this), alreadySelected = currentElement.hasClass('w_active');
                	veda["workflow"+elementId+"-selectedElement"] = _this.id;
               	    if (e.shiftKey) {
               	    	currentElement.addClass('jsplumb-drag-selected');
               	    	instance.addToDragSelection(currentElement);
               	    	e.stopPropagation();
               	    	return;
               	    }

                    if (!alreadySelected) {
	                    instance.defocus();
	                    
	                    selectedElementId = _this.id;
	                	selectedElementType = 'state';
	                    currentElement.addClass('w_active');
                    }
                    
                    if (mode=='edit') 
                    {
                    	e.stopPropagation();
                    	if (alreadySelected) {
                    		return; // do nothing when click on already selected element
                    	}

                    	var about = new veda.IndividualModel(_this.id);
                    	var holder = $("<div>");
                    	if (about['rdf:type'][0].id == 'v-wf:Task') 
                    	{
                    		about.present(holder, new veda.IndividualModel("v-wf:TaskTemplateAsProperties"), 'edit');
                    	} else {
                    		about.present(holder, new veda.IndividualModel("v-wf:ConditionTemplateAsProperties"), 'edit');
                    	}
                    	props.append(holder);
                    	if ( about.hasValue("rdfs:label") ) propsHead.text(about["rdfs:label"].join(", "));
                    	else propsHead.text(about.id);
                    }
                    
                    
                	// build run path
                    if (mode=='view') {
                		instance.select().removeClass('process-path-highlight').removeOverlay("pathCounter");
                    	var about = new veda.IndividualModel(_this.id);
                		if ( about.hasValue("rdfs:label") ) propsHead.text(about["rdfs:label"].join(", "));
                    	else propsHead.text(about.id);

                		// If we have more then one WorkItem - we must choose among them 
                    	if (currentElement.attr('work-items-count')>1) {
                    		e.stopPropagation();
	                    	var _this = this,
		                	   menu = $("#workflow-context-menu ul");
		                	menu.html('');
		                	
		                	$("[type='work-item']", _this).each(function() {
							  var wi = new veda.IndividualModel($(this).attr('work-item-id'));
							  var $item = $("<li/>").appendTo(menu);
							  $("<a/>", {
								   "text" : (wi.hasValue('rdfs:label')?wi['rdfs:label'][0]:wi.id), 
								   "href" : '#',
								   "click" : (function (wi) {
										return function (event) {
											event.preventDefault();
											props.empty();
											$("#workflow-context-menu").hide();
							            	$.each(instance.getAllConnections(), function (idx, connection) {
							            		var o = connection.getOverlay('flowLabel');
							            		if (o != undefined) o.setVisible(false);
							            	});
											instance.showProcessRunPath(wi, 0);
											var holder = $("<div>");
											wi.present(holder, new veda.IndividualModel("v-wf:WorkItemTemplate"));
											props.append(holder);
										};
									})(wi)
							  }).appendTo($item);
		                	});
		                	$contextMenu.css({
		                	   display: "block",
		                	   left: e.pageX-((e.pageX+$contextMenu.width()>$( document ).width())?$contextMenu.width():0),
		                	   top: e.pageY-((e.pageY+$contextMenu.height()>$( document ).height())?$contextMenu.height():0)
		                	});
                    	} else {
                    		e.stopPropagation();
                        	if (alreadySelected) {
                        		return; // do nothing when click on already selected element
                        	}
                        	$("[type='work-item']", _this).each(function() {
                        		var wi = new veda.IndividualModel($(this).attr('work-item-id'));
				            	$.each(instance.getAllConnections(), function (idx, connection) {
				            		var o = connection.getOverlay('flowLabel');
				            		if (o != undefined) o.setVisible(false);
				            	});
                        		instance.showProcessRunPath(wi, 0);
   	                	    	var holder = $("<div>");
   	                	    	wi.present(holder, new veda.IndividualModel("v-wf:WorkItemTemplate"));
   	                	    	props.append(holder);
    	                	});
                    	}
                    }
                });
                
                if (mode=='edit') {
	                windows.bind("dblclick", function() {
	                    var _this = this;
	                	riot.route("#/" + $(_this).attr('id')+"///edit", true);
	                });
	
	                instance.draggable(windows, {
	                  drag: function (event) { //gets called on every drag
	                	  $("#workflow-context-menu").hide();
	                	  var target = new veda.IndividualModel(event.el.id);
	                   	  target['v-wf:locationX'] = [new Number(Math.round(event.pos[0]-canvasSizePx/2))];
	                   	  target['v-wf:locationY'] = [new Number(Math.round(event.pos[1]-canvasSizePx/2))];
	                  }
	            	});
                }

                // Initialize all State elements as Connection sources.
                var possibleInAnchors = [[0, 0.1,-1, 0],
                                        [0, 0.3,-1, 0],
                                        [0, 0.5,-1, 0],
                                        [0, 0.7,-1, 0],
                                        [0, 0.9,-1, 0],
                                        [1, 0.1, 1, 0],
                                        [1, 0.3, 1, 0],
                                        [1, 0.5, 1, 0],
                                        [1, 0.7, 1, 0],
                                        [1, 0.9, 1, 0],
                                        [0.1, 0, 0,-1],
                                        [0.3, 0, 0,-1],
                                        [0.5, 0, 0,-1],
                                        [0.7, 0, 0,-1],
                                        [0.9, 0, 0,-1]];
                var possibleOutAnchors = [[0, 0.2,-1, 0],
                                       [0, 0.4,-1, 0],
                                       [0, 0.6,-1, 0],
                                       [0, 0.8,-1, 0],
                                       [1, 0.2, 1, 0],
                                       [1, 0.4, 1, 0],
                                       [1, 0.6, 1, 0],
                                       [1, 0.8, 1, 0],
                                       [0.2, 0, 0,-1],
                                       [0.4, 0, 0,-1],
                                       [0.6, 0, 0,-1],
                                       [0.8, 0, 0,-1]];
                instance.makeSource(windows, {
                    filter: ".ep",
                    anchor: possibleOutAnchors,
                    dragOptions : {
                    	isSource:false,
                		isTarget:true
                    },
                    connector: [
						"Straight", {
                    	stub: 30,
                        gap: 0
						}
                    ],paintStyle:{ 
                        strokeStyle:"#225588",
                        fillStyle:"transparent",
                        radius:mode=='edit'?4:1,
                        lineWidth:1 
                    },
                    connectorStyle: {
                        strokeStyle: "#666666",
                        lineWidth: 1,
                        outlineColor: "transparent",
                        outlineWidth: 4
                    },
                    maxConnections: 20,
                    onMaxConnections: function(info, e) {
                        alert("Maximum connections (" + info.maxConnections + ") reached");
                    }
                });

                // Initialize all State elements as connection targets.
                
                instance.makeTarget(windows, {
                    dropOptions: {
                    	isSource:true,
                		isTarget:false,
                        hoverClass: "dragHover"
                    },
                	reattach: true,
                    anchor: possibleInAnchors,
                    paintStyle:{ 
                        strokeStyle:"#225588",
                        fillStyle:"transparent",
                        radius:mode=='edit'?4:1,
                        lineWidth:1 
                    }
                });
            };

            /**
             * @method
             * Change current scale.
             * @param scale new scale
             */
            instance.changeScale = function(scale) {
            	$("#workflow-context-menu").hide();
            	
            	net['currentScale'] = parseFloat(scale);
            	veda["workflow"+elementId+"-zoom"] = net['currentScale'];
            	
            	instance.setZoom(net['currentScale']);
            	$('#'+workflowData).css({
            		'-ms-transform': 'scale('+net['currentScale']+','+net['currentScale']+')', /* IE 9 */
            		'-webkit-transform': 'scale('+net['currentScale']+','+net['currentScale']+')', /* Chrome, Safari, Opera */
            		'transform': 'scale('+net['currentScale']+','+net['currentScale']+')'
            	});
            };
            
            /**
             * @method getSplitJoinType
             * Generate css class for state (split-[xor-or-and-none] or join-[xor-or-and-none])
             * @param {String} sj `split` or `join`
             * @param {veda.IndividualModel} state state
             * @return css class name for this type of split/join  
             */
            instance.getSplitJoinType = function(sj, state) {
            	if (!state.hasValue('v-wf:'+sj)) {
            		return ' '+sj+'-no';
            	}
            	var type = state['v-wf:'+sj][0].id;
            	if (type === null || type === undefined || type === '') {
            		return ' '+sj+'-no';
            	}
            	
            	if (type == 'v-wf:XOR')  return ' '+sj+'-xor';
            	if (type == 'v-wf:OR')   return ' '+sj+'-or';
            	if (type == 'v-wf:AND')  return ' '+sj+'-and';
            	if (type == 'v-wf:NONE') return ' '+sj+'-none';
            	
            	return ' '+sj+'-no';
            };
            
            /**
             * @method
             * Apply state to canvas
             */
            instance.createState = function(state) {
            	if (!state.hasValue('rdf:type')) return;
            	var type = state['rdf:type'][0].id;
            	var stateElement = '';
            	switch (type) {
    			case 'v-wf:InputCondition':    				
    				stateElement = '<div class="w state-io-condition" ' + 
    				    'id="' + state.id + '" ' + 
    				    'style="font-size:20px;padding-top:10px;'+ 
    				    'left:' + (canvasSizePx/2+state['v-wf:locationX'][0]) + 'px;' +
    				    'top:' + (canvasSizePx/2+state['v-wf:locationY'][0]) + 'px;">' +
					    '<div><span class="glyphicon glyphicon-play" aria-hidden="true"></div>' +
					    (mode=='edit'?'<div class="ep">':'')+'</div></div>';
    				break;
    			case 'v-wf:OutputCondition':
    				stateElement = '<div class="w state-io-condition" ' +
    				    'id="' + state.id + '" ' +
    				    'style="font-size:20px;padding-top:10px;' +
    				    'left:' + (canvasSizePx/2+state['v-wf:locationX'][0]) + 'px;' + 
    				    'top: ' + (canvasSizePx/2+state['v-wf:locationY'][0]) + 'px;">' +
					    '<div><span class="glyphicon glyphicon-stop" aria-hidden="true"></div></div>';
    				break;
    			case 'v-wf:Condition':
    				stateElement = '<div class="w state-condition" ' +
    				    'id="' + state.id + '" ' + 
    				    'style="left:' + (canvasSizePx/2+state['v-wf:locationX'][0]) + 'px;' + 
    				    'top:' + (canvasSizePx/2+state['v-wf:locationY'][0]) + 'px;">' +
    				    '<div class="state-name condition-name">' + state['rdfs:label'][0] + '</div>' + 
    				    (mode=='edit'?'<div class="ep">':'')+'</div></div>';
    				break;
    			case 'v-wf:Task':    				
            		stateElement = '<div class="w state-task split-join ' +
					    instance.getSplitJoinType('split', state) +
					    instance.getSplitJoinType('join', state) + '" '+
					    'id="' + state.id + '" ' +
					    'style="left:' + (canvasSizePx/2+state['v-wf:locationX'][0]) + 'px; ' + 
					    'top: ' + (canvasSizePx/2+state['v-wf:locationY'][0]) + 'px;">' + 
					    '<div class="state-name">' + state['rdfs:label'][0] + '</div>' +
					    (mode=='edit'?'<div class="ep">':'')+'</div></div>';
    				break;
    			}            	
            	if (stateElement!=='') {
                	$('#'+workflowData).append(stateElement);
                	var $state = $('#' + veda.Util.escape4$(state.id));
                	bindStateEvents($state);
                	if (mode=='edit') subNetViewButton(state, $state);
                	executorMark(state, $state);
                	instance.updateSVGBackground($state);
            	}
            };
            
            instance.deleteState = function(element) {
            	instance.detachAllConnections(element);
            	instance.remove(element);
            	net['v-wf:consistsOf'] = veda.Util.removeSubIndividual(net, 'v-wf:consistsOf', element.id);
            };
            
            instance.createFlow = function(state, flow) {
            	var connector = instance.connect({
            		id: flow.id,
                    source: state.id,
                    target: flow['v-wf:flowsInto'][0].id,
                    detachable:(mode=='edit')
                });
            	if (flow.hasValue('rdfs:label'))
            	{
            		connector.addOverlay(["Label", { label: flow['rdfs:label'][0], location:0.5, id: "flowLabel"} ]);
            		//connector.setLabel(flow['rdfs:label'][0]);
            	}
            };
            
            instance.deleteFlow = function(flow, source) {
	           	instance.detach(flow, {fireEvent:false, forceDetach: true});
	          	net['v-wf:consistsOf'] = veda.Util.removeSubIndividual(net, 'v-wf:consistsOf', flow.id);
	           	var source = new veda.IndividualModel(source.id);
	       		source['v-wf:hasFlow'] = veda.Util.removeSubIndividual(source, 'v-wf:hasFlow', flow.id);
            }
            
            
            instance.createEmptyNetElement = function(type) {
        		var individual = new veda.IndividualModel(); 
                individual.defineProperty("rdf:type");
                individual.defineProperty("rdfs:label");
                individual.defineProperty("v-wf:locationX");
                individual.defineProperty("v-wf:locationY");
                
                individual['rdfs:label'] = ['', ''];
                individual['v-wf:locationX'] = [new Number((-canvasSizePx/2-net['offsetX'])/net['currentScale'])];
                individual['v-wf:locationY'] = [new Number((-canvasSizePx/2-net['offsetY'])/net['currentScale'])];

            	if (type=='condition') {
               		individual["rdf:type"] = [veda.ontology["v-wf:Condition"]];
                	instance.createState(individual);
                } else if (type=='task') { 
                    individual["rdf:type"] = [veda.ontology["v-wf:Task"]];
                	instance.createState(individual);
                } else if (type=='input') { 
                    individual["rdf:type"] = [veda.ontology["v-wf:InputCondition"]];
                	instance.createState(individual);
                } else if (type=='output') { 
                	individual['v-wf:locationX'] = [individual['v-wf:locationX'][0]+200];
                    individual["rdf:type"] = [veda.ontology["v-wf:OutputCondition"]];
                	instance.createState(individual);
                }
               	net['v-wf:consistsOf'] = (net['v-wf:consistsOf'] === undefined)?[individual]:net['v-wf:consistsOf'].concat([individual]);
               	return individual;
            }
            
            /**
             *Create workflow Net by given Object (v-wf:Net individual).
             *@method createNetView A public method
             *@param {Object} workflowData A workflow object to create State transitions
             */            
            instance.createNetView = function(net) {
            	$('#workflow-net-name').text(net['rdfs:label'][0]);
            	// Create States            	
            	var hasInput = false,
            		hasOutput = false;
            	
            	net['v-wf:consistsOf'].forEach(function(el) {
            		el['rdf:type'].forEach(function (type) {
            			instance.createState(el);
            			if (el.hasValue('rdf:type') && el['rdf:type'][0].id == 'v-wf:InputCondition') {
            				hasInput = true;
            			}
            			if (el.hasValue('rdf:type') && el['rdf:type'][0].id == 'v-wf:OutputCondition') {
            				hasOutput = true;
            			}
            		});
            	});
            	
            	// For empty net
            	if (!hasInput) {
                   	instance.createEmptyNetElement('input');
            	}            	
            	if (!hasOutput) {
                   	instance.createEmptyNetElement('output');
            	}
            	if (!net.hasValue('rdfs:label')) {
            		net.defineProperty("rdfs:label");  
            	}
            	
            	// Create Flows
            	net['v-wf:consistsOf'].forEach(function(el) {
            		if (undefined !== el['v-wf:hasFlow']) {
            			el['v-wf:hasFlow'].forEach(function (flow) {
            				instance.createFlow(el, flow);
            			});
            		}
            	});
            };
            
            /*
             * Optimize view of net: all elements must be visible and fit screen (through change scale and position of canvas)
             * @returns 
             */
            instance.optimizeView = function() {
            	if (!net.hasValue('v-wf:consistsOf')) return;
            	var minx, maxx, miny, maxy, scale, 
                  offsetX = 0, offsetY = 0;
            	// read ranges
            	net['v-wf:consistsOf'].forEach(function(state) {
            		if (state.hasValue('v-wf:locationX')) {
            			if (maxx === undefined || state['v-wf:locationX'][0]>maxx) maxx = state['v-wf:locationX'][0]; 
            			if (minx === undefined || state['v-wf:locationX'][0]<minx) minx = state['v-wf:locationX'][0];
            		}
            		if (state.hasValue('v-wf:locationY')) {
            			if (maxy === undefined || state['v-wf:locationY'][0]>maxy) maxy = state['v-wf:locationY'][0]; 
            			if (miny === undefined || state['v-wf:locationY'][0]<miny) miny = state['v-wf:locationY'][0];
            		}
            	});

            	// TODO update this from css;
            	miny-=25;
            	minx-=25;
            	maxx+=100;
            	maxy+=100;
            	
                
            	// read viewport div
            	$(".workflow-canvas-wrapper").each(function() {
            		var scaleX = this.clientWidth/(maxx-minx);
            		var scaleY = this.clientHeight/(maxy-miny);
            		scale = Math.min(scaleX, scaleY);
            		if (scaleX>scaleY) {
            			offsetX = (this.clientWidth - (maxx-minx)*scale) /2;
            		} else {
            			offsetY = (this.clientHeight - (maxy-miny)*scale) /2;
            		}
            	});
                instance.changeScale(scale);
                instance.moveCanvas(-minx*scale+offsetX-canvasSizePx/2, -miny*scale+offsetY-canvasSizePx/2);
            };
            
            instance.defocus = function() {
            	props.empty();
       	    	instance.clearDragSelection();
       	    	$('.jsplumb-drag-selected').removeClass('jsplumb-drag-selected');
            	$("#workflow-context-menu").hide();
            	$.each(instance.getAllConnections(), function (idx, connection) {
            		connection.removeClass('process-path-highlight');
            		connection.removeOverlay('pathCounter');
            		var o = connection.getOverlay('flowLabel');
            		if (o != undefined) o.setVisible(true);
            	});
                $('#'+veda.Util.escape4$(selectedElementId)).removeClass('w_active');
                if (selectedElementSourceId!=null) {
                	instance.select({source:selectedElementSourceId}).each(function(e) {
                        e.setPaintStyle({strokeStyle: "#666666"});
                        e.removeOverlay('connLabel');
                	});
                };
                selectedElementId = null;
                selectedElementType = null;
                selectedElementSourceId = null;
            };
            
            instance.loadProcessWorkItems = function(process, wis, usecache) {
            	if (process.hasValue('v-wf:workItemList')) {
            		process['v-wf:workItemList'].forEach(function(wi) {
            			wis.push(new veda.IndividualModel(wi.id, null, null, 'view', usecache));
            			instance.loadProcessWorkItems(wi, wis, usecache);
            		});
            	}
            }
            
            instance.createProcessView = function(process, reload) {
            	// Apply WorkItems to Net
    			var wis = [];
            	if (reload) {
            		instance.loadProcessWorkItems(process, wis, false);
            		$('.w').each(function(index) {
            			$("span", this ).text('');
            			$( this ).css('background-color', 'white').attr('work-items-count',0).attr('colored-to','');
            		});
            	} else {
            		instance.loadProcessWorkItems(process, wis, true);
            	}
            	wis.forEach(function(wi) {
            		if (wi.hasValue('v-wf:forNetElement')) {
            			var state = $('#'+veda.Util.escape4$(wi['v-wf:forNetElement'][0].id));
            			if ($(state).find('[work-item-id="'+veda.Util.escape4$(wi.id)+'"]').length == 0) {
	            			$("<span/>", {'type' :'work-item', 
	            						  'work-item-id': wi.id }).appendTo(state);
            			}
            			var wic = parseInt(state.attr('work-items-count'));
            			var red = state.attr('colored-to')=='red';    
            			if (wic>0) {                				
            				state.attr('work-items-count', wic+1);
            				$(".counter", state).remove();
            				$("<span/>", {
				   			   "class" : "counter",    
                         		   "text" : 'x'+(wic+1)
                         	   }).appendTo(state);                				
            			} else {
            				state.attr('work-items-count', 1);
            			}
        				if (!wi.hasValue('v-wf:workOrderList')) {
                			state.css('background-color', '#FF3333');
                			state.attr('colored-to', 'red');
        				} else if (wi.hasValue('v-wf:isCompleted') && wi['v-wf:isCompleted'][0]==true && !red) {
                			state.css('background-color', '#88B288');
                			state.attr('colored-to', 'green');
        				} else if (!red) {
                			state.css('background-color', '#FFB266');
                			state.attr('colored-to', 'red');
        				}
            		}
            	});            
            };

            instance.createNetView(net);
            if (mode=='view') {
            	instance.createProcessView(process);
            }
            
            if (net['currentScale']==1.0) {
            	instance.optimizeView();
            } else {
            	instance.changeScale(net['currentScale']);
            }
            
            $('#'+veda.Util.escape4$(veda["workflow"+elementId+"-selectedElement"])).trigger("click");
            
            /* CONTEXT MENU [BEGIN] */
            var $contextMenu = $("#workflow-context-menu");
            /* CONTEXT MENU [END]*/
            
            /* NET MENU [BEGIN] */
            $('#workflow-save-button').on('click', function() {
              // TODO REFACTOR - recursive save (based on type checking)
        	  if (net.hasValue('v-wf:consistsOf')) {
        		  net['v-wf:consistsOf'].forEach(function(el) {
        			function saveMapping(mapping, el) 
        			{
	            		if (el.hasValue(mapping)) {
	            			el[mapping].forEach(function(m) {
	            				if (m.hasValue('v-wf:mapToVariable')) {
	            					m['v-wf:mapToVariable'].forEach(function(v) {
	                        			v.save();
	                        		});
	            				}
	            				m.save();
	            			});
	            		}
        			}
        			saveMapping('v-wf:startingMapping', el);
        			saveMapping('v-wf:completedMapping', el);
        			saveMapping('v-wf:startingExecutorJournalMap', el);
        			saveMapping('v-wf:completedExecutorJournalMap', el);
        			saveMapping('v-wf:startingJournalMap', el);
        			saveMapping('v-wf:completedJournalMap', el);
            		if (el.hasValue('v-wf:executor')) {
            			el['v-wf:executor'].forEach(function(e) {
            				e.save();
            			});
            		}
            		el.save();
        		 });
        	  }
        	  net.save();
            });
            
            $('#workflow-export-ttl').on('click', function() {
           		var list = new veda.IndividualListModel(net, net['v-wf:consistsOf']);
           		/* temporary commented
	        	net['v-wf:consistsOf'].forEach(function(element) {
	        		element['rdf:type'].forEach(function (rdfType) {
		        		if (rdfType.id === 'v-wf:Task') {
		        			collectEntities(element, list);
		        		}
	        		});
	        	}); */
    			collectEntities(net, list);
           		veda.Util.exportTTL(list);
            });

            // Add new State event.
            $(".create-state").bind("click", function() {
                var _this = this,
                        stateId,
                        stateElement;
                var individual = instance.createEmptyNetElement($(_this).hasClass('create-condition')?'condition':'task');
                $('#' + individual.id).click();
                $(this).blur();
            });

            $('.delete-state').on('click', function() {
                if (selectedElementType == 'state') {
	                if (confirm('Delete state ' + selectedElementId + ' ?')) {
	                	instance.deleteState(instance.getSelector('#'+veda.Util.escape4$(selectedElementId))[0]);
	                }
                }
                if (selectedElementType == 'flow') {
	                if (confirm('Delete flow ' + selectedElementId + ' ?')) {
	                	instance.getConnections({
	                		  source:selectedElementSourceId 
	                	}).forEach(function(connection) {
	                		if (connection.id == selectedElementId) {
	                			instance.deleteFlow(connection, new veda.IndividualModel(selectedElementSourceId));
	                		}
	                	});
	                }
                }
            });
            
            $('.process-refresh').on('click', function() {
            	instance.createProcessView(process, true);
            });
            
            $('.to-net-editor').on('click', function() {
            	riot.route("#/" + net.id + "///edit", true);
            });
            
            $('.copy-net-element').on('click', function() {
            	if (typeof selectedElementId !== "undefined") {
            		var individual = new veda.IndividualModel(selectedElementId);
            		if (individual.hasValue('rdf:type')) {
            			if (individual['rdf:type'][0].id === 'v-wf:Task' || individual['rdf:type'][0].id === 'v-wf:Condition') {
            				individual = individual.clone();
            				individual['v-wf:locationX'] = [individual['v-wf:locationX'][0]+50];
            				individual['v-wf:locationY'] = [individual['v-wf:locationY'][0]+50];
            				individual['v-wf:hasFlow'] = [];
            				instance.createState(individual);
                           	net['v-wf:consistsOf'] = net['v-wf:consistsOf'].concat([individual]);
            			}
            		}
            	}
            });
            
            /* ZOOM [BEGIN] */
            $('.zoom-in').on('click', function() {
            	if (net['currentScale']<1) return instance.changeScale(net['currentScale'] + 0.1);
            	if (net['currentScale']<2) return instance.changeScale(net['currentScale'] + 0.25);
            });

            $('.zoom-out').on('click', function() {
            	if (net['currentScale']>1) return instance.changeScale(net['currentScale'] - 0.25);
            	if (net['currentScale']>0.2) return instance.changeScale(net['currentScale'] - 0.1);
            });
            
            $('#'+workflowData).bind('mousewheel', function(e){
            	if(e.originalEvent.wheelDelta > 0) {
            		if (net['currentScale']<1) { return instance.changeScale(net['currentScale'] + 0.1); }
            			else if (net['currentScale']<2) return instance.changeScale(net['currentScale'] + 0.25);
                } else {
                    if (net['currentScale']>1) { return instance.changeScale(net['currentScale'] - 0.25) }
                    	else if (net['currentScale']>0.2) return instance.changeScale(net['currentScale'] - 0.1);
                }
            });
            
            $('.zoom-default').on('click', function() {            	
            	instance.optimizeView();
            });
            
            $('#full-width').on('click', function() {            	
            	instance.optimizeView();
            });          
            /* ZOOM [END] */

            /* NET MENU [END] */
            
            return instance;
        };
    });
})();

function collectEntities(element, list) {
	var props = Object.getOwnPropertyNames(element);
    for (var key = 0; key < props.length; key++)
    {
    	var prop = props[key];
    	if (element[prop] && Array.isArray(element[prop])) {
    		element[prop].forEach(function(subelement) {
    			if (typeof subelement.hasValue === 'function' && subelement.hasValue('rdf:type')) 
    			{
    				subelement['rdf:type'].forEach(function (subRdfType) {
    					if (subRdfType.id == 'v-wf:VarDefine' || subRdfType.id == 'v-wf:Transform' || subRdfType.id == 'v-wf:Mapping') {
    						list.add(subelement);
    					}
    					if (subRdfType.id == 'v-wf:Mapping') {
    						list.add(subelement['v-wf:mapToVariable'][0]);
    					}
    				});
    			}
    		});
    	}
    }
}

//[END] Block of net editor
