

// >>> Section: Key state class


// The key state class contains detailed information about a keys state
function KeyState()
{
	var pressed_time = 0.0; // Time the key has been pressed or 0.0 if currently not pressed
	var pressedframe_time = 0.0; // Time the key has been pressed in this frame or 0.0 if currently not pressed
	var pressedframe_duration = 0.0; // Total duration the key had been pressed during this frame (even if currently not pressed)

	this.onKeyDown = function(t)
	{
		pressed_time = t;
		pressedframe_time = t;
	}
	this.onKeyUp = function(t)
	{
		pressed_time = 0.0;
		pressedframe_duration += (pressedframe_time != 0.0) * (t - pressedframe_time);
		pressedframe_time = 0.0;
	}
	this.onFrame = function(t)
	{
		if(pressedframe_time)
			pressedframe_time = t;
		pressedframe_duration = 0.0;
	}
	this.reset = function()
	{
		pressed_time = 0.0;
		pressedframe_time = 0.0;
		pressedframe_duration = 0.0;
	}

	this.isPressed = function()
	{
		return pressed_time != 0.0;
	}
	this.pressedDuration = function(t) // Duration since the key was pressed or 0.0 if not currently pressed
	{
		return pressed_time == 0.0 ? 0.0 : t - pressed_time;
	}
	this.pressedFrameDuration = function(t) // See pressedframe_duration
	{
		return pressedframe_duration + (pressedframe_time != 0.0) * (t - pressedframe_time);
	}
}


/*// >>> Section: Keyboard input handler


var pressedkeys = [];
for(i = 0; i < 255; i++) pressedkeys[i] = false;

function handleKeyDown(event)
{
	event.preventDefault();
	if(pressedkeys[event.keyCode] == false)
	{
		var t = new Date().getTime() / 1000.0 - starttime;

		pressedkeys[event.keyCode] = true;

		var statekeymap = keymap[statemachine.getState()];
		if(statekeymap)
		{
			// Perform any-key action
			var anykeyaction = statekeymap[-1];
			if(anykeyaction && anykeyaction[0])
				anykeyaction[0](t, event.keyCode);
			// Perform key specific action
			var keyaction = statekeymap[event.keyCode];
			if(keyaction && keyaction[0])
				keyaction[0](t, event.keyCode);
		}
	}
}
function handleKeyUp(event)
{
	event.preventDefault();
	if(pressedkeys[event.keyCode] == true)
	{
		var t = new Date().getTime() / 1000.0 - starttime;

		pressedkeys[event.keyCode] = false;

		var statekeymap = keymap[statemachine.getState()];
		if(statekeymap)
		{
			// Perform any-key action
			var anykeyaction = statekeymap[-1];
			if(anykeyaction && anykeyaction[1])
				anykeyaction[1](t, event.keyCode);
			// Perform key specific action
			var keyaction = statekeymap[event.keyCode];
			if(keyaction && keyaction[1])
				keyaction[1](t, event.keyCode);
		}
	}
}*/


// >>> Section: Mouse input handler


var mouseHandlers = [], mouseHandlerCanvasList = [];
var pressedmousebuttons = [];
function RegisterMouseHandler(cls, canvas)
{
	pressedmousebuttons[mouseHandlers.length] = [false, false, false, false];
	mouseHandlers.push(cls);
	mouseHandlerCanvasList.push(canvas);
}

function handleMouseDown(event)
{
	var canvas = event.target;
	var idx = mouseHandlerCanvasList.indexOf(event.target);
	var mouseHandler = mouseHandlers[idx];
	event.preventDefault();
	pressedmousebuttons[idx][event.which] = true;

	if(typeof(mouseHandler.onMouseDown) == 'function')
	{
		var canvasBounds = canvas.getBoundingClientRect();
		mouseHandler.onMouseDown(canvas, event.clientX - canvasBounds.left, event.clientY - canvasBounds.top, event.which);
	}
}
function handleMouseUp(event)
{
	for(var i = 0; i < mouseHandlers.length; ++i)
	{
		var canvas = mouseHandlerCanvasList[i];
		var mouseHandler = mouseHandlers[i];

		if(pressedmousebuttons[i][event.which] == true)
		{
			event.preventDefault();
			pressedmousebuttons[i][event.which] = false;
	
			if(typeof(mouseHandler.onMouseUp) == 'function')
			{
				var canvasBounds = canvas.getBoundingClientRect();
				mouseHandler.onMouseUp(canvas, event.clientX - canvasBounds.left, event.clientY - canvasBounds.top, event.which, event.target);
			}
		}
	}
}
function handleMouseMove(event)
{
	// Fire event for canvas with mouse down
	for(var i = 0; i < mouseHandlers.length; ++i)
	{
		var canvas = mouseHandlerCanvasList[i];
		var mouseHandler = mouseHandlers[i];
		
		if(pressedmousebuttons[i].some(function(button) { return button; }))
		{
			event.preventDefault();
			
			if(typeof(mouseHandler.onMouseMove) == 'function')
			{
				var canvasBounds = canvas.getBoundingClientRect();
				mouseHandler.onMouseMove(canvas, event.clientX - canvasBounds.left, event.clientY - canvasBounds.top, pressedmousebuttons[i]);
				return;
			}
		}
	}
	
	// If no canvas had mouse down, fire event for target (canvas under mouse cursor)
	var idx = mouseHandlerCanvasList.indexOf(event.target);
	if(idx != -1)
	{
		var canvas = event.target;
		var mouseHandler = mouseHandlers[idx];
		if(typeof(mouseHandler.onMouseMove) == 'function')
		{
			canvas = mouseHandler.canvas;
			event.preventDefault();
			var canvasBounds = canvas.getBoundingClientRect();
			mouseHandler.onMouseMove(event.target, event.clientX - canvasBounds.left, event.clientY - canvasBounds.top, pressedmousebuttons[idx]);
		}
	}
}
function handleMouseLeave(event)
{
	var canvas = event.target;
	var idx = mouseHandlerCanvasList.indexOf(event.target);
	var mouseHandler = mouseHandlers[idx];
	event.preventDefault();

	if(typeof(mouseHandler.onMouseLeave) == 'function')
	{
		var canvasBounds = canvas.getBoundingClientRect();
		mouseHandler.onMouseLeave(canvas, event.clientX - canvasBounds.left, event.clientY - canvasBounds.top, pressedmousebuttons[idx]);
	}
}
function handleMouseWheel(event)
{
	var canvas = event.target;
	var idx = mouseHandlerCanvasList.indexOf(event.target);
	var mouseHandler = mouseHandlers[idx];
	if(mouseHandler != null && typeof(mouseHandler.onMouseWheel) == 'function')
	{
		var deltaZ = event.wheelDelta == null ? event.detail : -event.wheelDelta / 20.0;
		
		event.preventDefault();
		var canvasBounds = canvas.getBoundingClientRect();
		mouseHandler.onMouseWheel(canvas, event.clientX - canvasBounds.left, event.clientY - canvasBounds.top, deltaZ, pressedmousebuttons[idx]);
	}
}