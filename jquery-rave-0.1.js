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
(function($) {
  "use strict";
  // internal object used to store info about all monitored fields
  var boundFields = {};
  // tracks current ongoing validations
  var ongoingValidations = 0;
  // define the events that potentially cause an element to become invalid
  var methods = {
    init : function(options) {
      return this.each(function() {
        var $this = $(this);
        methods.log('Added: ' + $this.attr("id"));
        var internalKey, elementType;
        // analyse element type and define an internal key to be used to store data about the
        // element
        if ($this.is("select")) {
          internalKey = $this.attr("id");
          elementType = "select";
        } else if ($this.is("input:text")) {
          internalKey = $this.attr("id");
          elementType = "text";
        } else if ($this.is("input:radio")) {
          internalKey = $this.attr("name");
          elementType = "radio";
        } else if ($this.is("input:checkbox")) {
          internalKey = $this.attr("name");
          elementType = "checkbox";
        } else {
          methods.log('Unsupported field type found: ' + $this.attr("id"));
          return;
        }
        // associate internal id with the field
        var data = $this.data('rave');
        if (!data) {
          $(this).data('rave', {
            internalKey : internalKey
          });
        }
        // merge the user supplied options with the option defaults for the elementtype
        var fieldOptions = $.extend({}, fieldDefaults[elementType], options);
        /*
         * initial : while a field is in initial state and doesn't change its value, it is not
         * validated even if the triggerValidationEvent is fired 
         * valid : Field has been validated and is valid 
         * invalid : Field has been validated and is invalid 
         * revalidate : Field needs to be revalidated (value changed) 
         * pending : Field is currently being validated
         */
        // add the field to the boundFields object
        if (boundFields[internalKey] == null) {
          boundFields[internalKey] = {
            targets : [$this.context],
            state : 'initial',
            options : fieldOptions,
            type : elementType,
            skip : false
          };
        } else {
          // radio and checkbox fields that share the same name are stored as one validation unit
          boundFields[internalKey].targets.push($this.context);
        }
        var fieldData = boundFields[internalKey];
        // retrieve current field value (method depends on the fieldtype) and store it
        fieldData.value = fieldData.options.getValue(fieldData.targets);
        // register stateChangeEvent
        $this.on(fieldData.options.stateChangeEvent, function() {
          var internalKey = $(this).data('rave').internalKey;
          var fieldData = boundFields[internalKey];
          var newValue = fieldData.options.getValue(fieldData.targets);
          var oldValue = fieldData.value;
          if (newValue != oldValue) {
            methods.log('valuechange, state of ' + internalKey + " was reset to undefind");
            boundFields[internalKey].value = newValue;
            boundFields[internalKey].state = 'revalidate';
          }
        });
        
        //function delays the callback unitl ms time has passed, resets ms if called within ms
        var delayedCall = (function(){
          var timer = 0;
          return function(callback, ms){
            clearTimeout (timer);
            timer = setTimeout(callback, ms);
          };
        })();
        // register triggerValidationEvent
        //TODO we're always using delayedCall, even with delays of 0.
        $this.on(fieldData.options.triggerValidationEvent, function() {
          var $this = $(this);
          delayedCall(function(){
            var internalKey = $this.data('rave').internalKey;
            var field = boundFields[internalKey];
            //update skip info on the element
            field.skip = methods.isSkipped(field);
            if (boundFields[internalKey].state === 'revalidate' && !field.skip) {
              ongoingValidations++;
              methods.validateField($this);
            }
          },fieldData.options.delayValidation);
          
        });
      });
    },
    validateField : function(field) {
      var $field = $(field);
      var internalKey = $field.data('rave').internalKey;
      boundFields[internalKey].state = 'pending'
      methods.log('need to validate ' + internalKey);
      $field.trigger('validation_pending');
      // create a copy of the validator array
      var validators = boundFields[internalKey].options.validate.slice(0);
      methods.recursiveValidateField(validators, $(boundFields[internalKey].targets), internalKey, $field);
    },
    recursiveValidateField : function(validatorArray, targets, internalKey, field) {
      var singleValidation = validatorArray.shift();
      $.when(singleValidation(targets)).then(function(data) {
        methods.log("got result:" + data.state);
        // if valid and there are more validators in the array, to the next one
        if (data.state === "valid" && validatorArray.length > 0) {
          methods.recursiveValidateField(validatorArray, targets, internalKey, field);
        } else {
          // otherwise we are either done with all validators, or the last one returned invalid
          methods.handleValidationResult(data, internalKey, field);
        }
      });
    },
    handleValidationResult : function(data, internalKey, field) {
      if (data.state === "valid") {
        methods.log('valid ' + internalKey);
        field.trigger('validation_valid', data);
        boundFields[internalKey].state = 'valid';
      } else {
        methods.log('invalid ' + internalKey);
        field.trigger('validation_invalid', data);
        boundFields[internalKey].state = 'invalid';
      }
      ongoingValidations--;
      methods.evaluateGlobalState();
    },
    
    /**
     * Triggers validation of all fields registered.  
     * Individual field validation is triggered only if:
     * - the field is not in state 'valid'
     * - the field is within the (optional) provided scope (true if the field is a descendent of the scope element)
     * - the fields 'skipValidation' callback doesn't return true (if a callback was provided with the options)
     * 
     * @param scope optional JQuery object defining the scope for validation 
     */
    validateAll : function(scope) {
      methods.log("global validation");
      var toValidate = [];
      // 1) find out what needs to be validated and push it into an array
      jQuery.each(boundFields, function(key, field) {
        
        // if scope was provided, check if the field is a decendant of scope, only validate if that is true
        var inScope;
        if (typeof scope === 'undefined'){
          inScope = true;
        } else{
          inScope = jQuery(scope).find($(field.targets[0])).length > 0; 
        } 
        // update skip info 
        field.skip = !inScope || methods.isSkipped(field);
        
        //TODO: define what to do with fields that are in state error:
        // 1) retrigger error event with latest cached response data?
        // 2) change state to revalidate and therefor validate the field again (but why redo expensive validation if the field value has not changed? why should it be valid now?)
        // 3) leave in error state, and do nothing else (problem: if you have closable error messages, a closed msg will not be opened again..)
        if (field.state !== 'valid' && !field.skip) {
          ongoingValidations++;
          toValidate.push(field);
        }
      });
      // special case, no validations pending, all is valid
      if (ongoingValidations === 0) {
        methods.evaluateGlobalState();
      } else {
        // start validating the boundfields
        jQuery.each(toValidate, function(index, field) {
            methods.validateField($(field.targets));
        });
      }
    },
    evaluateGlobalState : function() {
      methods.log("checking global state.");
      // overall state is undefined while validations are still running
      if (ongoingValidations !== 0) {
        return;
      }
      var valid = true;
      jQuery.each(boundFields, function(key, value) {
        //boundField must be valid or currently skipped
        valid &= value.state === 'valid' || value.skip;
        methods.log(key + " is " + value.state);
      });
      methods.log("global state is:" + valid);
      if (valid) {
        $.event.trigger('global_validation_result', {
          state : "valid"
        });
      } else {
        $.event.trigger('global_validation_result', {
          state : "invalid"
        });
      }
    },
    /**
     * returns the value of a text or select input field
     * 
     * @param targets an array containing DOM nodes
     */
    getFieldValue : function(targets) {
      return $(targets).val();
    },
    /**
     * returns the value of the currently selected radio
     * 
     * @param targets an array containing DOM nodes
     */
    getRadioValue : function(targets) {
      return jQuery(targets).filter(':checked').val();
    },
    /**
     * returns an array containing all values of checked checkboxes
     * 
     * @param targets an array containing DOM nodes
     */
    getCheckboxValue : function(targets) {
      var values = [];
      jQuery(targets).filter(':checked').each(function() {
        values.push($(this).val());
      });
      return values;
    },
    /**
     * do not skip validation of the target field
     * @param targets
     * @returns {Boolean}
     */
    noSkip : function(targets){
      return false;
    },
    
    isSkipped : function(value){
      return value.options.skipValidation(value.targets);
    },
    
    log : function(msg){
      var debug = false;
      if (debug === true){
        console.log(msg);
      }
    }
    
    
  };
  /**
   * Default configuration depending on field type
   * 
   */
  var fieldDefaults = {
    text : {
      stateChangeEvent : 'keyup',
      triggerValidationEvent : 'blur',
      getValue : methods.getFieldValue,
      skipValidation : methods.noSkip,
      delayValidation : 0
    },
    select : {
      stateChangeEvent : 'change',
      triggerValidationEvent : 'change',
      getValue : methods.getFieldValue,
      skipValidation : methods.noSkip,
      delayValidation : 0
    },
    radio : {
      stateChangeEvent : 'change',
      triggerValidationEvent : 'change',
      getValue : methods.getRadioValue,
      skipValidation : methods.noSkip,
      delayValidation : 0
    },
    checkbox : {
      stateChangeEvent : 'change',
      triggerValidationEvent : 'change',
      getValue : methods.getCheckboxValue,
      skipValidation : methods.noSkip,
      delayValidation : 0
    }
  };
  $.fn.validate = function(method) {
    // Method calling logic
    if (methods[method]) {
      return methods[method].apply(this, Array.prototype.slice.call(arguments, 1));
    } else if (typeof method === 'object' || !method) {
      return methods.init.apply(this, arguments);
    } else {
      $.error('Method ' + method + ' does not exist on jQuery-rave');
    }
  };
})(jQuery);
