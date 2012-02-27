(function( $ ){
	
  var boundElements = [];
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
          boundElements.push($this);
          var data = $this.data('databind');
          //supported states: initial, valid, invalid, revalidate
          if ( ! data ) {
            $(this).data('databind', {
                target : $this,
                value : $this.val(),
                state : 'initial',
                options : options
            });
          }
          
          var elementType = methods.getElementType($(this));
          //TODO allow passing the events as options
          var stateChangeEvent = stateChangeEvents[elementType];
          var reValidateEvent = triggerValidationEvents[elementType];
          
          $(this).on(stateChangeEvent, function(){
        	  var newValue = $(this).val();
        	  var oldValue = $(this).data('databind').value
        	  if (newValue != oldValue){
        		  console.log('valuechange, state of '+$(this).attr("id")+" was reset to undefind"); 
        		  $(this).data('databind').value = newValue;
        		  $(this).data('databind').state = 'revalidate';
        	  }
          });
          $(this).on(reValidateEvent, function(){
        	  if ($(this).data('databind').state == 'revalidate'){
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
    	jQuery.each(boundElements, function(){
    		valid &= $(this).data('databind').state == 'valid';
    		console.log($(this).data('databind').state);
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
		console.log('need to validate '+field.attr("id"));
		field.trigger('databind_validation_pending');
		field.data('databind').options.validate(field, function(result){
			if (result == true){
				console.log('valid '+field.attr("id"));
				field.trigger('databind_validation_valid');
				field.data('databind').state = 'valid';
			}else{
				console.log('invalid '+field.attr("id"));
				field.trigger('databind_validation_invalid');
				field.data('databind').state = 'invalid';
			}
	  		ongoingValidations--;
	  		methods.evaluateGlobalState();
		});  	  	
    },
    
    validateAll : function(){
    	console.log("global validation");    	
    	jQuery.each(boundElements, function(){
    		if ($(this).data('databind').state == 'initial'){
    			$(this).data('databind').state = 'revalidate';
    		}
    		if ($(this).data('databind').state == 'revalidate'){
    			ongoingValidations++;
    		}
    	});
    	//special case, no validations pending, all is valid
    	if (ongoingValidations == 0){
    		methods.evaluateGlobalState();
    	}else{
    		jQuery.each(boundElements, function(){
    			if ($(this).data('databind').state == 'revalidate'){
    				methods.validateField($(this));
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