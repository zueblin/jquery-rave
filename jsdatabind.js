(function( $ ){

	var boundFields = {};
	var ongoingValidations = 0;
	//define the events that cause 
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

					var internalId, elementType;
					//analyse element type and define an internal key to be used to store data about the element
					if ($this.is("select")){
						internalId = $this.attr("id");
						elementType = "select";
					}else if ($this.is("input:text")){
						internalId = $this.attr("id");
						elementType = "text";
					}else if ($this.is("input:radio")){
						internalId = $this.attr("name");
						elementType = "radio";
					}else if ($this.is("input:checkbox")){
						internalId = $this.attr("name");
						elementType = "checkbox";
					}
					//associate internal id with the field
					var data = $this.data('databind');
					if ( ! data ) {
						$(this).data('databind', {
							internalId : internalId
						});
					}

					//add the field to the boundFields hash
					//supported states: initial, valid, invalid, revalidate
					if (boundFields[internalId] == null){
						boundFields[internalId] = {
								targets : [$this.context],
								state : 'initial',
								options : options,
								type : elementType
						}  
					}else{
						boundFields[internalId].targets.push($this.context);
					}
					//retrieve field value (method depends on the fieldtype)
					var fieldValue = methods.getValue(internalId);
					//store current value 
					boundFields[internalId].value = fieldValue;

					//TODO allow passing the events as options
					var stateChangeEvent = stateChangeEvents[elementType];
					var reValidateEvent = triggerValidationEvents[elementType];

					$this.on(stateChangeEvent, function(){
						var internalId = $(this).data('databind').internalId;
						var newValue = methods.getValue(internalId);
						var oldValue = boundFields[internalId].value;
						if (newValue != oldValue){
							console.log('valuechange, state of '+internalId+" was reset to undefind"); 
							boundFields[internalId].value = newValue;
							boundFields[internalId].state = 'revalidate';
						}
					});
					$this.on(reValidateEvent, function(){
						var internalId = $(this).data('databind').internalId;
						if (boundFields[internalId].state == 'revalidate'){
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
					$.event.trigger('databind.globalState', {state:"valid"});
				}else{
					$.event.trigger('databind.globalState', {state:"invalid"});
				}
			},

			validateField : function(field) {
				field = $(field);
				var internalId = field.data('databind').internalId;
				console.log('need to validate '+internalId);
				field.trigger('databind_validation_pending');
				boundFields[internalId].options.validate($(boundFields[internalId].targets), function(result){
					if (result == true){
						console.log('valid '+internalId);
						field.trigger('databind_validation_valid');
						boundFields[internalId].state = 'valid';
					}else{
						console.log('invalid '+internalId);
						field.trigger('databind_validation_invalid');
						boundFields[internalId].state = 'invalid';
					}
					ongoingValidations--;
					methods.evaluateGlobalState();
				});  	  	
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

			getValue : function(internalId){
				var targets = boundFields[internalId].targets;
				var type = boundFields[internalId].type;
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
				console.log("internalId:"+internalId+" value:"+value);
				return value;
			}

	};

	$.fn.databind = function( method ) {

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