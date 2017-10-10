

function stateBrowseInit()
{
}


function stateBrowseCyclic()
{
}


// >>> Section: State machine


function StateMachine(initialstate)
{
	var state;
	var nextstate = initialstate;

	this.update = function(t, dt)
	{
		if(this.state == nextstate)
		{
			this.state(t, dt);
			return true; // Draw frame
		}
		else
		{
			this.state = nextstate;
			return false; // Skip drawing frame and reset timer
		}
	}
	this.getState = function()
	{
		return this.state;
	}
	this.setState = function(newstate)
	{
		nextstate = newstate;
	}
}
var statemachine = new StateMachine(stateBrowseInit);


// >>> Section: Mouse and keyboard mappings


// Connect actions to key-down and key-up events of specific keys when the statemachine is in a given state
// Syntax: keymap[state][key_code] = [key_down_action, key_up_action];
var keymap = {};

// Connect actions to button-down and button-up events of specific mouse buttons when the statemachine is in a given state
// Syntax: mousebuttonmap[state][key_code] = [key_down_action, key_up_action, mouse_move_while_key_down_action];
var mousebuttonmap = {}, mousewheelmap = {};