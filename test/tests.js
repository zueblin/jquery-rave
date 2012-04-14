// without input form is invalid
test('evaluate global state', function() {
	 var validation_state;
	 
	 $(document).on('global_validation_result', function(event, data) {
			    validation_state = data.state;
			    ok(true, 'global validation result triggered');    
			});
	 $.when($.fn.validate('evaluateGlobalState')).then(function() {
							       ok(true, 'evaluate globale state called');
							       equal(validation_state, 'invalid');
							   });
     });

//
test('get field value from input', function() {
     equal($.fn.validate('getFieldValue', $('#input_text')), 2);
});


// test engine with remote validation
test('validateInputField', function() {
	 $.mockjax({
	      url: 'validate/form1',
	      dataType: 'json',
	      responseText : {
		  state : 'valid',
		  msg : 'input is valid'
	      }
	  });


	 $.fn.validate('validateAll');
	 ok($('#input_text').nextAll('.msg').text === 'valid', 'text input is valid');
	 $.mockjaxClear();
});

