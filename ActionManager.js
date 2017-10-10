var HIDE_UNDO_REDO_BUTTONS = false;

function ActionManager(_cmdUndo, _cmdUndo2, _cmdRedo, _cmdRedo2)
{
	var registered = [];
	var history = {prev: null, next: null, action: null};
	var cmdUndo = _cmdUndo, cmdUndo2 = _cmdUndo2, cmdRedo = _cmdRedo, cmdRedo2 = _cmdRedo2;
	
	this.register = function(name, dofunc, undofunc, redofunc) // redofunc ... optional
	{
		registered[name] = {name, dofunc, undofunc, redofunc};
	}
	
	this.perform = function(name, params)
	{
		var action = registered[name];
		if(action == null)
			return;
		
		history = (history.next = {prev: history, next: null, action: action, doParams: params});
		history.undoParams = action.dofunc(params);
		this.UpdateUndoRedoButtons();
		//console.log("DO: " + name + "(" + params + ")");
	}
	
	this.undo = function()
	{
		if(this.canUndo())
		{
			if(history.action.redofunc)
				history.doParams = history.action.undofunc(history.undoParams);
			else
				history.action.undofunc(history.undoParams);
			//console.log("UNDO: " + history.action.name + "(" + history.undoParams + ")");
			history = history.prev;
			this.UpdateUndoRedoButtons();
		}
	}
	this.redo = function()
	{
		if(this.canRedo())
		{
			history = history.next;
			history.undoParams = history.action.redofunc ? history.action.redofunc(history.doParams) : history.action.dofunc(history.doParams);
			this.UpdateUndoRedoButtons();
			//console.log("REDO: " + history.action.name + "(" + history.doParams + ")");
		}
	}
	
	this.canUndo = function()
	{
		return history.action !== null;
	}
	this.canRedo = function()
	{
		return history.next !== null;
	}
	
	this.UpdateUndoRedoButtons = function()
	{
		if(this.canUndo())
		{
			cmdUndo2.style.display = 'none';
			cmdUndo.style.display = HIDE_UNDO_REDO_BUTTONS === true ? 'none' : 'inline-block';
		}
		else
		{
			cmdUndo.style.display = 'none';
			cmdUndo2.style.display = HIDE_UNDO_REDO_BUTTONS === true ? 'none' : 'inline-block';
		}
		if(this.canRedo())
		{
			cmdRedo2.style.display = 'none';
			cmdRedo.style.display = HIDE_UNDO_REDO_BUTTONS === true ? 'none' : 'inline-block';
		}
		else
		{
			cmdRedo.style.display = 'none';
			cmdRedo2.style.display = HIDE_UNDO_REDO_BUTTONS === true ? 'none' : 'inline-block';
		}
	}
	this.UpdateUndoRedoButtons();
}