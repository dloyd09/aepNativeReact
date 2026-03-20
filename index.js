// Custom entry point: install global error handler BEFORE any modules load.
// This catches errors that occur during module-level import evaluation.
var Alert = require('react-native').Alert;

if (global.ErrorUtils && typeof global.ErrorUtils.setGlobalHandler === 'function') {
  global.ErrorUtils.setGlobalHandler(function (error, isFatal) {
    var msg = (error && error.message) || 'Unknown error';
    var stack = (error && error.stack && error.stack.split('\n').slice(0, 6).join('\n')) || '';
    Alert.alert(
      isFatal ? '[FATAL] Launch Crash' : '[ERROR] Launch Error',
      msg + '\n\n' + stack,
      [{ text: 'OK' }]
    );
  });
}

try {
  // Also catch unhandled Promise rejections (separate pathway in RN 0.79)
if (typeof global.HermesInternal !== 'undefined') {
  // Hermes-specific unhandled rejection tracking
  var originalPromise = global.Promise;
  if (originalPromise && originalPromise.reject) {
    var OriginalPromise = originalPromise;
    // Use process event if available
  }
}

// Standard unhandledrejection event
if (typeof global.addEventListener === 'function') {
  global.addEventListener('unhandledrejection', function(event) {
    var reason = event && event.reason;
    var msg = (reason && reason.message) || String(reason) || 'Unhandled Promise rejection';
    Alert.alert('[FATAL] Unhandled Promise Rejection', msg, [{ text: 'OK' }]);
    event.preventDefault && event.preventDefault();
  });
}

require('expo-router/entry');
} catch (e) {
  Alert.alert(
    '[FATAL] Module Load Error',
    (e && e.message) || 'Unknown module error',
    [{ text: 'OK' }]
  );
}
