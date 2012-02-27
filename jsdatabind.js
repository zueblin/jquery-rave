(function( $ ){
	
  var boundFields = {};
  var ongoingValidations = 0;
  //define the events that cause 
  var stateChangeEvents = {
		  "text": "keyup",
		  "select": "change",
		  "radio": "change"
  };
  var triggerValidationEvents = {
		  "text": "blur",
		  "select": "change",
		  "radio": "change"
  };

  var methods = {
    init : function( options ) { 
      return this.each(function(){
    	  console.log('something was added:'+$(this).attr("id"));
    	  
    	  var $this = $(this);
    	  
    	  var internalId = methods.getInternalId($this);
    	  
    	  //associate internal id with the field
    	  var data = $this.data('databind');
    	  if ( ! data ) {
              $(this).data('databind', {
                  internalId : internalId                  
              });
          }
    	  
    	  //create data object for field
    	  //supported states: initial, valid, invalid, revalidate
    	  
    	  if (boundFields[internalId] == null){
    		  boundFields[internalId] = {
    	                targets : [$this.context],
    	                state : 'initial',
    	                options : options
    	            }  
    	  }else{
    		  boundFields[internalId].targets.push($this.context);
    	  }
    	  var fieldValue = methods.getValue(internalId);
    	  //store current value 
    	  boundFields[internalId].value = fieldValue;
          
          var elementType = methods.getElementType($this);
          //TODO allow passing the events as options
          var stateChangeEvent = stateChangeEvents[elementType];
          var reValidateEvent = triggerValidationEvents[elementType];
          
          $(this).on(stateChangeEvent, function(){
        	  var internalId = $(this).data('databind').internalId;
        	  var newValue = methods.getValue(internalId);
        	  var oldValue = boundFields[internalId].value;
        	  if (newValue != oldValue){
        		  console.log('valuechange, state of '+internalId+" was reset to undefind"); 
        		  boundFields[internalId].value = newValue;
        		  boundFields[internalId].state = 'revalidate';
        	  }
          });
          $(this).on(reValidateEvent, function(){
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
    	if (ongoingValidations != 0){
    		//$.event.trigger('databind.globalState', {"state": "pending"});
    		return;
    	}
    	var valid = true;
    	jQuery.each(boundFields, function(key, value){
    		valid &= value.state == 'valid';
    		console.log(value.state);
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
    		jQuery.each(boundElements, function(key, value){
    			if (value.state == 'revalidate'){
    				methods.validateField($(value.targets));
    			}
    		});
    	}
    },
    
    getElementType : function(field){
    	if ($(field).is("select")){
    		return "select";
    	} 	
    	if ($(field).is("input:text")){
    		return "text";
    	}
    	if ($(field).is("input:radio")){
    		return "radio";
    	}
    	if ($(field).is("input:checkbox")){
    		return "checkbox";
    	}
    },
    
    getInternalId : function(field){
    	if ($(field).is("select")){
    		return $(field).attr("id");
    	} 	
    	if ($(field).is("input:text")){
    		return $(field).attr("id");
    	}
    	if ($(field).is("input:radio")){
    		return $(field).attr("name");
    	}
    	if ($(field).is("input:checkbox")){
    		return $(field).attr("name");
    	}
    },
    
    getValue : function(internalId){
    	var targets = boundFields[internalId].targets;
    	var value;
    	if (targets.length <= 1){
    		value = $(targets).val();
    	}else{
    		value = jQuery(targets).filter(':checked').val();
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