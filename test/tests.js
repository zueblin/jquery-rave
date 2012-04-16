function DefaultRemoteValidation(url) {
  this.url = url;
  this.validate = [function(field){return remoteValidation(field, url)}];
}

var remoteValidation = function(field, url) {
  return $.ajax({
    url: url,
    data: $(field).attr('id')+"="+$(field).val()
  });
};

//
test('get field value from input', function() {
  expect(1);
  equal($.fn.validate('getFieldValue', $('#input_text1')), 2, 'correctly read value from input field');
});


// evaluate global state test
// input_text3 is invalid -> global state is invalid
test('evaluate global state', function() {
  expect(3);
  
  $.mockjax({
    url: 'validate/form2/input_text3',
    dataType: 'json',
    responseText: {
      state: 'invalid'
    }
  });
  
  $('#input_text3').validate(new DefaultRemoteValidation('validate/form2/input_text3'));
  
  $(document).on('global_validation_result', function(event, data) {
    validation_state = data.state;
    ok(true, 'global validation result triggered');
    equal(data.state, 'invalid', 'global state is invalid');
  });

  $.when($.fn.validate('evaluateGlobalState')).then(function() {
    ok(true, 'evaluate globale state called');
  });
  
  $(document).off();
  $.mockjaxClear();
});

// testing the scope functionality
test('scope test', function() {
  expect(1);
  
  $.mockjax({
    url: 'validate/form2/input_text2',
    dataType: 'json',
    responseText: {
      state: 'valid'
    }
  });
 
  $('#input_text2').validate(new DefaultRemoteValidation('validate/form2/input_text2'));

  $('#input_text2').on('validation_valid', function(event, data){
    equal(data.state, 'valid', 'input_text2 is valid');
    start();
  });
  
  $.fn.validate('validateAll', $('#form2-div1'));
  stop();
  
  $.mockjaxClear();
});