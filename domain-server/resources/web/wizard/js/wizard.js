var Metaverse = {
  accessToken: null
}

$(document).ready(function(){
  Strings.ADD_PLACE_NOT_CONNECTED_MESSAGE = "You must have an access token to query your High Fidelity places.<br><br>" +
    "Please go back and connect your account.";

  $('#connect-account-btn').attr('href', URLs.METAVERSE_URL + "/user/tokens/new?for_domain_server=true");

  $('[data-toggle="tooltip"]').tooltip();

  $('body').on('click', '.next-button', function() {
    goToNextStep();
  });

  $('body').on('click', '.back-button', function() {
    goToPreviousStep();
  });

  $('body').on('click', '#skip-wizard-button', function() {
    skipWizard();
  })

  $('body').on('click', '#connect-account-btn', function() {
    $(this).blur();
    prepareAccessTokenPrompt(function(accessToken) {
      Metaverse.accessToken = accessToken;
      saveAccessToken();
    });
  });

  $('body').on('click', '#save-permissions', function() {
    savePermissions();
  });

  function triggerSaveUsernamePassword(event) {
      if (event.keyCode === 13) {
          $("#save-username-password").click();
      }
  }
  $("#http_username").keyup(triggerSaveUsernamePassword);
  $("#http_password").keyup(triggerSaveUsernamePassword);
  $("#verify_http_password").keyup(triggerSaveUsernamePassword);
  $('body').on('click', '#save-username-password', function() {
    saveUsernamePassword();
  });

  $('body').on('click', '#change-place-name', function() {
    chooseFromHighFidelityPlaces(Settings.data.values.metaverse.access_token, "/0,-10,0", function(placeName) {
      updatePlaceNameLink(placeName);
    });
  });

  $('body').on('click', '#explore-settings', function() {
    exploreSettings();
  });

  reloadSettings(function(success) {
    if (success) {
      setupWizardSteps();
      updatePlaceNameDisplay();
      updateUsernameDisplay();
    } else {
      swal({
        title: '',
        type: 'error',
        text: "There was a problem loading the domain settings.\nPlease refresh the page to try again.",
      });
    }
  });
});

function setupWizardSteps() {
  var stepsCompleted = Settings.data.values.wizard.steps_completed;
  var steps = null;

  if (Settings.data.values.wizard.cloud_domain) {
    $('.desktop-only').remove();
    $('.wizard-step').find('.back-button').hide();

    steps = $('.wizard-step');
    $(steps).each(function(i) {
      $(this).children(".step-title").text("Step " + (i + 1) + " of " + (steps.length - 1));
    });

    $('#permissions-description').html('You <span id="username-display"></span>have been assigned administrator privileges to this domain.');
    $('#admin-description').html('Add more High Fidelity usernames to grant administrator privileges.');
  } else {
    $('.cloud-only').remove();
    $('#save-permissions').text("Finish");

    steps = $('.wizard-step');
    $(steps).each(function(i) {
      $(this).children(".step-title").text("Step " + (i + 1) + " of " + steps.length);
    });

    if (stepsCompleted == 0) {
      $('#skip-wizard-button').show();
    }
  }

  var currentStep = steps[stepsCompleted];
  $(currentStep).show();
}

function updatePlaceNameLink(address) {
  if (address) {
    $('#place-name-link').html('Your domain is reachable at: <a target="_blank" href="' + URLs.PLACE_URL + '/' + address + '">' + address + '</a>');
  }
}

function updatePlaceNameDisplay() {
  if (Settings.data.values.metaverse.id) {
    $.getJSON(URLs.METAVERSE_URL + '/api/v1/domains/' + Settings.data.values.metaverse.id, function(data) {

      if (data.status === 'success') {
        if (data.domain.default_place_name) {
          // Place name
          updatePlaceNameLink(data.domain.default_place_name);
        } else if (data.domain.name) {
          // Temporary name
          updatePlaceNameLink(data.domain.name);
        } else if (data.domain.network_address) {
          if (data.domain.network_port !== 40102) {
            // IP:PORT
            updatePlaceNameLink(data.domain.network_address + ':' + data.domain.network_port);
          } else {
            // IP
            updatePlaceNameLink(data.domain.network_address);
          }
        }
      } else {
        console.warn('Request Failed');
      }
    }).fail(function() {
      console.warn('Request Failed');
    });
  } else {
    console.warn('No metaverse domain ID!');
  }
}

function updateUsernameDisplay() {
  var permissions = Settings.data.values.security.permissions;
  if (permissions.length > 0) {
    $('#username-display').html('<b>(' + permissions[0].permissions_id + ')</b> ');
  }
}

function reloadSettings(callback) {
  $.getJSON('/settings.json', function(data){
    Settings.data = data;

    if (callback) {
      // call the callback now that settings are loaded
      callback(true);
    }
  }).fail(function() {
    if (callback) {
      // call the failure object since settings load failed
      callback(false)
    }
  });
}

function postSettings(jsonSettings, callback) {
  console.log("----- SAVING ------");
  console.log(JSON.stringify(jsonSettings));

  // POST the form JSON to the domain-server settings.json endpoint so the settings are saved
  $.ajax('/settings.json', {
    data: JSON.stringify(jsonSettings),
    contentType: 'application/json',
    type: 'POST'
  }).done(function(data){
    if (data.status == "success") {
      if (callback) {
        callback();
      }
      reloadSettings();
    } else {
      swal("Error", Strings.LOADING_SETTINGS_ERROR)
      reloadSettings();
    }
  }).fail(function(){
    swal("Error", Strings.LOADING_SETTINGS_ERROR)
    reloadSettings();
  });
}

function goToNextStep() {
  $('#skip-wizard-button').hide();

  var currentStep = $('body').find('.wizard-step:visible');
  var nextStep = currentStep.next('.wizard-step');

  var formJSON = {
    "wizard": {}
  }

  if (nextStep.length > 0) {
    currentStep.hide();
    nextStep.show();

    var currentStepNumber = parseInt(Settings.data.values.wizard.steps_completed) + 1;

    postSettings({
      "wizard": {
        "steps_completed": currentStepNumber.toString()
      }
    });
  } else {
    postSettings({
      "wizard": {
        "steps_completed": "0",
        "completed_once": true
      }
    }, redirectToSettings);
  }
}

function goToPreviousStep() {
  var currentStep = $('body').find('.wizard-step:visible');
  var previousStep = currentStep.prev('.wizard-step');

  var formJSON = {
    "wizard": {}
  }

  if (previousStep.length > 0) {
    currentStep.hide();
    previousStep.show();

    var currentStepNumber = parseInt(Settings.data.values.wizard.steps_completed) - 1;

    postSettings({
      "wizard": {
        "steps_completed": currentStepNumber.toString()
      }
    });
  }
}

function skipWizard() {
  postSettings({
    "wizard": {
      "steps_completed": "0",
      "completed_once": true
    }
  }, redirectToSettings);
}

function redirectToSettings() {
  var redirectURL = "/settings" + location.search;
  if (Settings.data.values.wizard.cloud_domain) {
    if (location.search.length > 0) {
      redirectURL += "&";
    } else {
      redirectURL += "?";
    }
    redirectURL += "cloud-wizard-exit";
  }
  location.href = redirectURL;
}

function saveAccessToken() {
  var formJSON = {
    "metaverse": {}
  }
  if (Metaverse.accessToken) {
    formJSON.metaverse.access_token = Metaverse.accessToken;
  }

  // remove focus from the button
  $(this).blur();

  // POST the form JSON to the domain-server settings.json endpoint so the settings are saved
  postSettings(formJSON, goToNextStep);
}

function getSettingDescriptionForKey(groupKey, settingKey) {
  for (var i in Settings.data.descriptions) {
    var group = Settings.data.descriptions[i];
    if (group.name === groupKey) {
      for (var j in group.settings) {
        var setting = group.settings[j];
        if (setting.name === settingKey) {
          return setting;
        }
      }
    }
  }
}

function savePermissions() {
  var localhostPermissions = (Settings.data.values.wizard.cloud_domain !== true)
  var anonymousCanConnect = false;
  var friendsCanConnect = false;
  var loggedInCanConnect = false;
  var anonymousCanRez = false;
  var friendsCanRez = false;
  var loggedInCanRez = false;

  var connectValue = $('input[name=connect-radio]:checked').val();
  var rezValue = $('input[name=rez-radio]:checked').val();

  switch (connectValue) {
    case "friends":
      friendsCanConnect = true;
      break;
    case "logged-in":
      friendsCanConnect = true;
      loggedInCanConnect = true;
      break;
    case "everyone":
      anonymousCanConnect = true;
      friendsCanConnect = true;
      loggedInCanConnect = true;
      break;
  }

  switch (rezValue) {
    case "friends":
      friendsCanRez = true;
      break;
    case "logged-in":
      friendsCanRez = true;
      loggedInCanRez = true;
      break;
    case "everyone":
      anonymousCanRez = true;
      friendsCanRez = true;
      loggedInCanRez = true;
      break;
  }

  var admins = $('#admin-usernames').val().split(',');

  var existingAdmins = Settings.data.values.security.permissions.map(function(value) {
    return value.permissions_id;
  });
  admins = admins.concat(existingAdmins);

  // Filter out unique values
  admins = _.uniq(admins.map(function(username) {
    return username.trim();
  })).filter(function(username) {
    return username !== "";
  });

  var formJSON = {
    "security": {
      "standard_permissions": [
        {
          "id_can_connect": anonymousCanConnect,
          "id_can_rez": anonymousCanRez,
          "id_can_rez_certified": anonymousCanRez,
          "id_can_rez_tmp": anonymousCanRez,
          "id_can_rez_tmp_certified": anonymousCanRez,
          "permissions_id": "anonymous"
        },
        {
          "id_can_connect": friendsCanConnect,
          "id_can_rez": friendsCanRez,
          "id_can_rez_certified": friendsCanRez,
          "id_can_rez_tmp": friendsCanRez,
          "id_can_rez_tmp_certified": friendsCanRez,
          "permissions_id": "friends"
        },
        {
          "id_can_connect": loggedInCanConnect,
          "id_can_rez": loggedInCanRez,
          "id_can_rez_certified": loggedInCanRez,
          "id_can_rez_tmp": loggedInCanRez,
          "id_can_rez_tmp_certified": loggedInCanRez,
          "permissions_id": "logged-in"
        },
        {
          "id_can_adjust_locks": localhostPermissions,
          "id_can_connect": localhostPermissions,
          "id_can_connect_past_max_capacity": localhostPermissions,
          "id_can_kick": localhostPermissions,
          "id_can_replace_content": localhostPermissions,
          "id_can_rez": localhostPermissions,
          "id_can_rez_certified": localhostPermissions,
          "id_can_rez_tmp": localhostPermissions,
          "id_can_rez_tmp_certified": localhostPermissions,
          "id_can_write_to_asset_server": localhostPermissions,
          "permissions_id": "localhost"
        }
      ]
    }
  }

  if (admins.length > 0) {
    formJSON.security.permissions = [];

    var permissionsDesc = getSettingDescriptionForKey("security", "permissions");
    for (var i in admins) {
      var admin = admins[i];
      var perms = {};
      for (var i in permissionsDesc.columns) {
        var name = permissionsDesc.columns[i].name;
        if (name === "permissions_id") {
          perms[name] = admin;
        } else {
          perms[name] = true;
        }
      }
      formJSON.security.permissions.push(perms);
    }
  }

  // remove focus from the button
  $(this).blur();

  postSettings(formJSON, goToNextStep);
}

function saveUsernamePassword() {
  var username = $("#http_username").val();
  var password = $("#http_password").val();
  var verify_password = $("#verify_http_password").val();

  if (username.length == 0) {
    bootbox.alert({ "message": "You must set a username!", "title": "Username Error" });
    return;
  }

  if (password.length == 0) {
    bootbox.alert({ "message": "You must set a password!", "title": "Password Error" });
    return;
  }

  if (password != verify_password) {
    bootbox.alert({ "message": "Passwords must match!", "title": "Password Error" });
    return;
  }

  var currentStepNumber = parseInt(Settings.data.values.wizard.steps_completed) + 1;

  var formJSON = {
    "security": {
      "http_username": username,
      "http_password": sha256_digest(password)
    },
    "wizard": {
      "steps_completed": currentStepNumber.toString()
    }
  }

  // remove focus from the button
  $(this).blur();

  // POST the form JSON to the domain-server settings.json endpoint so the settings are saved
  postSettings(formJSON, function() {
    location.reload();
  });
}

function exploreSettings() {
  if ($('#go-to-domain').is(":checked")) {
    var link = $('#place-name-link a:first');
    if (link.length > 0) {
      window.open(link.attr("href"));
    }
  }

  goToNextStep();
}