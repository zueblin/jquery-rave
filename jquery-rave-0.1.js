/*!
 * Real Asynchronous Validation Engine, jQuery plugin
 *
 * Copyright(c) 2012, Thomas Zueblin
 *
 * Validation framework tailored for asynchronous 
 * serverside validation of form input fields.
 *
 * Licensed under the MIT License
 */

(function( $ ){

	var boundFields = {};
	var ongoingValidations = 0;
	//define the events that potentially cause an element to become invalid 
	var stateChangeEvents = {
			"text": "keyup",
			"select": "change",
			"radio": "change",
			"checkbox": "change"
	};
	var triggerValidationEvents = {
			"text": "blur",
			"select": "change",
			"radio": "change",
			"checkbox": "change"
	};

	var methods = {
			init : function( options ) { 
				return this.each(function(){
					console.log('something was added:'+$(this).attr("id"));

					var $this = $(this);

					var internalKey, elementType;
					//analyse element type and define an internal key to be used to store data about the element
					if ($this.is("select")){
						internalKey = $this.attr("id");
						elementType = "select";
					}else if ($this.is("input:text")){
						internalKey = $this.attr("id");
						elementType = "text";
					}else if ($this.is("input:radio")){
						internalKey = $this.attr("name");
						elementType = "radio";
					}else if ($this.is("input:checkbox")){
						internalKey = $this.attr("name");
						elementType = "checkbox";
					}
					//associate internal id with the field
					var data = $this.data('databind');
					if ( ! data ) {
						$(this).data('databind', {
							internalKey : internalKey
						});
					}

					//add the field to the boundFields hash
					//supported states: initial, valid, invalid, revalidate
					if (boundFields[internalKey] == null){
						boundFields[internalKey] = {
								targets : [$this.context],
								state : 'initial',
								options : options,
								type : elementType
						}  
					}else{
						boundFields[internalKey].targets.push($this.context);
					}
					//retrieve field value (method depends on the fieldtype)
					var fieldValue = methods.getValue(internalKey);
					//store current value 
					boundFields[internalKey].value = fieldValue;

					//TODO allow passing the events as options
					var stateChangeEvent = stateChangeEvents[elementType];
					var reValidateEvent = triggerValidationEvents[elementType];

					$this.on(stateChangeEvent, function(){
						var internalKey = $(this).data('databind').internalKey;
						var newValue = methods.getValue(internalKey);
						var oldValue = boundFields[internalKey].value;
						if (newValue != oldValue){
							console.log('valuechange, state of '+internalKey+" was reset to undefind"); 
							boundFields[internalKey].value = newValue;
							boundFields[internalKey].state = 'revalidate';
						}
					});
					$this.on(reValidateEvent, function(){
						var internalKey = $(this).data('databind').internalKey;
						if (boundFields[internalKey].state == 'revalidate'){
							ongoingValidations++;
							methods.validateField(this)
						}
					});
				});
			},
			evaluateGlobalState : function( ) {
				console.log("checking global state.");
				//overall state of cannot is undefined while validations are still running
				if (ongoingValidations != 0){
					//$.event.trigger('databind.globalState', {"state": "pending"});
					return;
				}
				var valid = true;
				jQuery.each(boundFields, function(key, value){
					valid &= value.state == 'valid';
					console.log(key+" is "+value.state);
				});
				console.log("global state is:"+valid);
				if (valid){
					$.event.trigger('global_validation_result', {state:"valid"});
				}else{
					$.event.trigger('global_validation_result', {state:"invalid"});
				}
			},

			validateField : function(field) {
				field = $(field);
				var internalKey = field.data('databind').internalKey;
				console.log('need to validate '+internalKey);
				field.trigger('validation_pending');
				// create a copy of the validator array
				var validators = boundFields[internalKey].options.validate.slice(0);
				methods.recursiveValidateField(validators, $(boundFields[internalKey].targets), internalKey, field);
			},
			
			recursiveValidateField : function(validatorArray, targets, internalKey, field){
			  var singleValidation = validatorArray.shift();
			  $.when(singleValidation(targets)).then(function(data){
				  console.log("got result:"+data.state);
				  // if valid and there are more validators in the array, to the next one
				  if (data.state === "valid" && validatorArray.length > 0){
					  methods.recursiveValidateField(validatorArray, targets, internalKey, field);
				  }else{
					  //otherwise we are either done with all validators, or the last one returned invalid
					  methods.handleValidationResult(data, internalKey, field);
				  }
			  });
			},
			
			handleValidationResult : function (data, internalKey, field){
				if (data.state === "valid"){
					console.log('valid '+internalKey);
					field.trigger('validation_valid');
					boundFields[internalKey].state = 'valid';
				}else{
					console.log('invalid '+internalKey);
					field.trigger('validation_invalid');
					boundFields[internalKey].state = 'invalid';
				}
				ongoingValidations--;
				methods.evaluateGlobalState();
			},


			validateAll : function(){
				console.log("global validation");    	
				jQuery.each(boundFields, function(key, value){
					if (value.state == 'initial'){
						value.state = 'revalidate';
					}
					if (value.state == 'revalidate'){
						ongoingValidations++;
					}
				});
				//special case, no validations pending, all is valid
				if (ongoingValidations == 0){
					methods.evaluateGlobalState();
				}else{
					jQuery.each(boundFields, function(key, value){
						if (value.state == 'revalidate'){
							methods.validateField($(value.targets));
						}
					});
				}
			},

			getValue : function(internalKey){
				var targets = boundFields[internalKey].targets;
				var type = boundFields[internalKey].type;
				var value;

				switch (type) {
					case "select": 
						value = $(targets).val();
						break;
					case "text": 
						value = $(targets).val();
						break;
					case "radio": 
						value = jQuery(targets).filter(':checked').val();
						break;
					case "checkbox": 
						value = [];
						jQuery(targets).filter(':checked').each(function(){value.push($(this).val())});
						break;
				}
				console.log("internalKey:"+internalKey+" value:"+value);
				return value;
			}

	};

	$.fn.validate = function( method ) {

		// Method calling logic
		if ( methods[method] ) {
			return methods[ method ].apply( this, Array.prototype.slice.call( arguments, 1 ));
		} else if ( typeof method === 'object' || ! method ) {
			return methods.init.apply( this, arguments );
		} else {
			$.error( 'Method ' +  method + ' does not exist on jQuery.databind' );
		}    

	};

})( jQuery );