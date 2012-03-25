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

	//internal object used to store info about all monitored fields
	var boundFields = {};
	//tracks current ongoing validations
	var ongoingValidations = 0;
	//define the events that potentially cause an element to become invalid 
	
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
					var data = $this.data('rave');
					if ( ! data ) {
						$(this).data('rave', {
							internalKey : internalKey
						});
					}
					
					// merge the user supplied options with the option defaults for the elementtype
					var fieldOptions = $.extend({}, fieldDefaults[elementType], options);

					/*
					 * initial : while a field is in initial state and doesn't change its value, 
					 * 				it is not validated even if the triggerValidationEvent is fired
					 * valid : Field has been validated and is valid
					 * invalid : Field has been validated and is invalid
					 * revalidate : Field needs to be revalidated (value changed) 
					 * pending : Field is currently being validated
					 */

					//add the field to the boundFields object
					if (boundFields[internalKey] == null){
						boundFields[internalKey] = {
								targets : [$this.context],
								state : 'initial',
								options : fieldOptions,
								type : elementType
						}  
					}else{
						//radio and checkbox fields that share the same name are stored as one validation unit 
						boundFields[internalKey].targets.push($this.context);
					}
					
					var fieldData = boundFields[internalKey];
					//retrieve current field value (method depends on the fieldtype) and store it
					fieldData.value = fieldData.options.getValue(fieldData.targets);

					// register stateChangeEvent
					$this.on(fieldData.options.stateChangeEvent, function(){
						var internalKey = $(this).data('rave').internalKey;
						var fieldData = boundFields[internalKey];
						
						var newValue = fieldData.options.getValue(fieldData.targets);
						var oldValue = fieldData.value;
						if (newValue != oldValue){
							console.log('valuechange, state of '+internalKey+" was reset to undefind"); 
							boundFields[internalKey].value = newValue;
							boundFields[internalKey].state = 'revalidate';
						}
					});
					// register triggerValidationEvent
					$this.on(fieldData.options.triggerValidationEvent, function(){
						var internalKey = $(this).data('rave').internalKey;
						if (boundFields[internalKey].state == 'revalidate'){
							methods.validateField(this)
						}
					});
				});
			},

			validateField : function(field) {
				$field = $(field);
				var internalKey = $field.data('rave').internalKey;
				ongoingValidations++;
				boundFields[internalKey].state = 'pending'
				console.log('need to validate '+internalKey);
				$field.trigger('validation_pending');
				// create a copy of the validator array
				var validators = boundFields[internalKey].options.validate.slice(0);
				methods.recursiveValidateField(validators, $(boundFields[internalKey].targets), internalKey, $field);
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
			
			/**
			 * returns the value of a text or select input field
			 * @param targets an array containing DOM nodes
			 * 			 */
			getFieldValue : function(targets){
				return $(targets).val();
			},
			
			/**
			 * returns the value of the currently selected radio
			 * @param targets an array containing DOM nodes
			 */
			getRadioValue : function(targets){
				return jQuery(targets).filter(':checked').val();
			},
			
			/**
			 * returns an array containing all values of checked checkboxes
			 * @param targets an array containing DOM nodes
			 */
			getCheckboxValue : function(targets){
				values = [];
				jQuery(targets).filter(':checked').each(function(){
					values.push($(this).val())
				});
				return values;
			}

	};
	/**
	 * Default configuration depending on field type
	 * 
	 */
	var fieldDefaults = {
			'text' : {
				'stateChangeEvent' : 'keyup',
				'triggerValidationEvent' : 'blur',
				'getValue' : methods.getFieldValue
			},
			'select' : {
				'stateChangeEvent' : 'change',
				'triggerValidationEvent' : 'change',
				'getValue' : methods.getFieldValue
			},
			'radio' : {
				'stateChangeEvent' : 'change',
				'triggerValidationEvent' : 'change',
				'getValue' : methods.getRadioValue
			},
			'checkbox' : {
				'stateChangeEvent' : 'change',
				'triggerValidationEvent' : 'change',
				'getValue' : methods.getCheckboxValue
			}
	};

	$.fn.validate = function( method ) {

		// Method calling logic
		if ( methods[method] ) {
			return methods[ method ].apply( this, Array.prototype.slice.call( arguments, 1 ));
		} else if ( typeof method === 'object' || ! method ) {
			return methods.init.apply( this, arguments );
		} else {
			$.error( 'Method ' +  method + ' does not exist on jQuery-rave' );
		}    

	};

})( jQuery );