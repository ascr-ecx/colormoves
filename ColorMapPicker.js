function ColorMapPicker()
{
	var activeSolidColormap = null;

	function createColormapEntry(colorMap, colorMapName, cell, useLabel, useButton)
	{
		var canvas = document.createElement('canvas');
		canvas.id = useButton ? "tableColorMapPicker_canvas_s" : "tableColorMapPicker_canvas"
		canvas.width = COLOR_MAP_SIZE;
		canvas.height = 1;
		canvas.tag_id = colorMapName;
		canvas.draggable = "true";
		canvas.ondragstart = colorMap_onDragStart;
		canvas.ondragend = colorMap_onDragEnd;
		var ctx = colorMap.tag_context = canvas.getContext("2d");
		var imgdata = ctx.getImageData(0, 0, COLOR_MAP_SIZE, 1);
		for(var i = 0; i < colorMap.bytes.length; ++i)
			imgdata.data[i] = colorMap.bytes[i];
		for(var x = 0; x < COLOR_MAP_SIZE; x += Math.floor(colorMap.bytes.length / 4))
			ctx.putImageData(imgdata, x, 0);
		
		// Draw splitters
		if(colorMap.splitters)
			for(var i = 2; i < colorMap.splitters.length; ++i)
			{
				var x = colorMap.splitters[i].pos * COLOR_MAP_SIZE;
				ctx.fillStyle="#FFFFFF";
				ctx.fillRect(x - COLOR_MAP_SIZE / 200, 0, COLOR_MAP_SIZE / 200, 1);
				ctx.fillStyle="#000000";
				ctx.fillRect(x, 0, COLOR_MAP_SIZE / 100, 1);
			}
		
		if(useLabel)
		{
			var label = document.createElement('label');
			label.id = "tableColorMapPicker_label";
			label.innerHTML = colorMapName;
		}
		
		if(useButton)
		{
			var button = document.createElement('input');
			button.id = "tableColorMapPicker_button";
			button.type = "image";
			button.src = "flipButton.png"
			button.tag_canvas = canvas;
			button.tag_colorMap = colorMap;
			button.onclick = colorMap_onFlipClick;
		}
		
		if(!useLabel)
			//canvas.style.width = '100%';
		{
			canvas.style.width = canvas.style.height = '16';
			canvas.style.border = '1px solid #000000';
		}
		if(useButton)
			cell.appendChild(button);
		cell.appendChild(canvas);
		if(useLabel)
			cell.appendChild(label);
	}
	
	this.recreatePicker = function()
	{
		// Remove old table //EDIT: It is slow and inefficient to recreate the whole table
		var tableColorMapPicker = document.getElementById('tableColorMapPicker');
		for(var i = tableColorMapPicker.rows.length - 1; i >= 0; --i)
			tableColorMapPicker.deleteRow(i);
		
		var colorMapGroupSizes = [], maxColorMapGroupSize = 0, colorMapGroupIndices = [];
		var i = 0;
		for(var colorMapName in colorMaps)
		{
			if(colorMapName === '_default' || colorMaps[colorMapName].inPicker === false)
				continue;
			
			var colorMap = colorMaps[colorMapName];
			if(colorMap.group == "")
				colorMaps[colorMapName].group = "Custom";
			
			if(colorMapGroupSizes[colorMap.group] == null)
				colorMapGroupSizes[colorMap.group] = 0;
			maxColorMapGroupSize = Math.max(maxColorMapGroupSize, ++colorMapGroupSizes[colorMap.group]);
			if(colorMapGroupIndices[colorMap.group] == null)
				colorMapGroupIndices[colorMap.group] = i++;
		}
		
		// Count solid colormaps
		var numSolid = 1; // 1 ... add-color button
		for(var colorMapName in colorMaps)
		{
			if(colorMapName === '_default' || colorMaps[colorMapName].inPicker === false)
				continue;
			
			if(colorMaps[colorMapName].group == "Solid")
				++numSolid;
		}
		
		var SOLIDS_PER_ROW = 6;
		var numSolidColumns = Math.min(numSolid, SOLIDS_PER_ROW);
		var numSolidRows = Math.floor((numSolid - 1) / numSolidColumns) + 1;

		var tbody = tableColorMapPicker.createTBody();
		for (var i = numSolidRows; i--;)
			tbody.insertRow(-1);
		var rowSolidIndex = 0;
		var indexSolid = 0;
		var rowMap = [];
		for(var colorMapName in colorMaps)
		{
			if(colorMapName === '_default' || colorMaps[colorMapName].inPicker === false)
				continue;
			
			var colorMap = colorMaps[colorMapName];
			
			var isSolid = colorMap.group == "Solid";
			if(colorMap.group == "Solid")
			{
				if(indexSolid++ == numSolidColumns)
				{
					++rowSolidIndex;
					indexSolid = 1;
				}
				
				var cell = tbody.rows[rowSolidIndex].insertCell(-1);
				createColormapEntry(colorMap, colorMapName, cell, false, false);
			}
			else
			{
				if(rowMap[colorMap.group] == null)
				{
					tbody.insertRow(-1).style.height = '18px'; // Insert empty row before every new group
					rowMap[colorMap.group] = tbody.rows.length;
				}
				var rowInsertIndex = rowMap[colorMap.group];
				
				var row = tbody.insertRow(rowInsertIndex);
				var cell = row.insertCell(-1);
				cell.colSpan = numSolidColumns;
				createColormapEntry(colorMap, colorMapName, cell, true, true);
				
				for(var groupName in rowMap)
					if(rowMap[groupName] >= rowInsertIndex)
						++rowMap[groupName];
			}
		}

		// Add add-color button
		if(indexSolid++ == numSolidColumns)
		{
			++rowSolidIndex;
			indexSolid = 1;
		}
		cell = tbody.rows[rowSolidIndex].insertCell(-1);
		var addclrimg = document.createElement('img');
		addclrimg.id = "tableColorMapPicker_addclrimg";
		addclrimg.src = "addColorButton.png"
		cell.appendChild(addclrimg);
		var addclr = document.createElement('input');
		addclr.id = "tableColorMapPicker_addclr";
		addclr.type = "color";
		addclr.src = "addColorButton.png"
		var hex = function(v) { var str = v.toString(16); return ('00'+str).substring(str.length); };
		addclr.onclick = function() {
			var r = parseInt(this.value.slice(1, 3), 16);
			var g = parseInt(this.value.slice(3, 5), 16);
			var b = parseInt(this.value.slice(5, 7), 16);
			var colormapName = "0x" + hex(r) + hex(g) + hex(b);
			var colormap = {name: colormapName, group: 'Solid', nanclr: [0.0, 0.0, 0.0], bytes: [r, g, b, 255], inPicker: true};
			var colormaps = {}; colormaps[colormapName] = colormap; onColorMapsLoaded(colormaps);
			activeSolidColormap = colormap;
		};
		addclr.oninput = function() {
			if (activeSolidColormap !== null) {}
				var r = parseInt(this.value.slice(1, 3), 16);
				var g = parseInt(this.value.slice(3, 5), 16);
				var b = parseInt(this.value.slice(5, 7), 16);
				
				// Visually update colormap
				var ctx = activeSolidColormap.tag_context;
				var imgdata = ctx.getImageData(0, 0, COLOR_MAP_SIZE, 1);
				imgdata.data[0] = activeSolidColormap.bytes[0] = r;
				imgdata.data[1] = activeSolidColormap.bytes[1] = g;
				imgdata.data[2] = activeSolidColormap.bytes[2] = b;
				for(var x = 0; x < COLOR_MAP_SIZE; ++x)
					ctx.putImageData(imgdata, x, 0);
		};
		addclr.onchange = function() {
			if (activeSolidColormap !== null)
			{
				// Remove colormap
				var oldColormapName = activeSolidColormap.name;
				var colormaps = {};
				colormaps[oldColormapName] = activeSolidColormap;
				onColorMapsUnloaded(colormaps);

				// Readd colormap under new name
				var newColormapName = "0x" + hex(activeSolidColormap.bytes[0]) + hex(activeSolidColormap.bytes[1]) + hex(activeSolidColormap.bytes[2]);
				activeSolidColormap.name = newColormapName; // Update colormap name
				activeSolidColormap.texI = null; // Update colormap textures
				activeSolidColormap.texCM = null; // Update colormap textures
				colormaps = {};
				colormaps[newColormapName] = activeSolidColormap;
				onColorMapsLoaded(colormaps);
			}
		};
		cell.appendChild(addclr);
		
		/*var headerRow = tableColorMapPicker.createTHead().insertRow(-1);
		for(var colorMapGroupName in colorMapGroupSizes)
		{
			//headerRow.insertCell(-1).innerHTML = "<b>" + colorMapGroupName + "</b>";
			var th = document.createElement('th');
			th.innerHTML = colorMapGroupName;
			headerRow.appendChild(th);
			if(colorMapGroupName == "Solid")
				th.style.width = "50px";
		}
		
		var tbody = tableColorMapPicker.createTBody();
		var rows = [];
		for(var i = 0; i < maxColorMapGroupSize; ++i)
		{
			var row = tbody.insertRow(-1);
			var cells;
			rows.push(cells = []);
			for(var colorMapGroupName in colorMapGroupSizes)
				cells.push(row.insertCell(-1));
		}
		var rowIndices = [];
		for(var colorMapName in colorMaps)
		{
			if(colorMapName === '_default' || colorMaps[colorMapName].inPicker === false)
				continue;
			
			var colorMap = colorMaps[colorMapName];
			var isSolid = colorMap.group == "Solid";
			
			var canvas = document.createElement('canvas');
			canvas.id = isSolid ? "tableColorMapPicker_canvas_s" : "tableColorMapPicker_canvas"
			canvas.width = COLOR_MAP_SIZE;
			canvas.height = 1;
			canvas.tag_id = colorMapName;
			canvas.draggable = "true";
			canvas.ondragstart = colorMap_onDragStart;
			canvas.ondragend = colorMap_onDragEnd;
			var ctx = canvas.getContext("2d");
			var imgdata = ctx.getImageData(0, 0, COLOR_MAP_SIZE, 1);
			for(var i = 0; i < colorMap.bytes.length; ++i)
				imgdata.data[i] = colorMap.bytes[i];
			for(var x = 0; x < COLOR_MAP_SIZE; x += Math.floor(colorMap.bytes.length / 4))
				ctx.putImageData(imgdata, x, 0);
			
			// Draw splitters
			if(colorMap.splitters)
				for(var i = 2; i < colorMap.splitters.length; ++i)
				{
					var x = colorMap.splitters[i].pos * COLOR_MAP_SIZE;
					ctx.fillStyle="#FFFFFF";
					ctx.fillRect(x - COLOR_MAP_SIZE / 200, 0, COLOR_MAP_SIZE / 200, 1);
					ctx.fillStyle="#000000";
					ctx.fillRect(x, 0, COLOR_MAP_SIZE / 100, 1);
				}
			
			var label = document.createElement('label');
			label.id = "tableColorMapPicker_label";
			label.innerHTML = colorMapName;
			
			if(!isSolid)
			{
				var button = document.createElement('input');
				button.id = "tableColorMapPicker_button";
				button.type = "image";
				button.src = "flipButton.png"
				button.tag_canvas = canvas;
				button.tag_colorMap = colorMap;
				button.onclick = colorMap_onFlipClick;
			}
			
			if(rowIndices[colorMap.group] == null)
				rowIndices[colorMap.group] = 0;
			var cells = rows[rowIndices[colorMap.group]++];
			var cell = cells[colorMapGroupIndices[colorMap.group]];
			if(!isSolid)
				cell.appendChild(button);
			cell.appendChild(canvas);
			cell.appendChild(label);
		}*/
	}
	
	this.recreatePicker_old = function()
	{
		// Remove old table //EDIT: It is slow and inefficient to recreate the whole table
		var tableColorMapPicker = document.getElementById('tableColorMapPicker');
		for(var i = tableColorMapPicker.rows.length - 1; i >= 0; --i)
			tableColorMapPicker.deleteRow(i);
		
		var colorMapGroupSizes = [], maxColorMapGroupSize = 0, colorMapGroupIndices = [];
		var i = 0;
		for(var colorMapName in colorMaps)
		{
			if(colorMapName === '_default' || colorMaps[colorMapName].inPicker === false)
				continue;
			
			var colorMap = colorMaps[colorMapName];
			if(colorMap.group == "")
				colorMaps[colorMapName].group = "Custom";
			
			if(colorMapGroupSizes[colorMap.group] == null)
				colorMapGroupSizes[colorMap.group] = 0;
			maxColorMapGroupSize = Math.max(maxColorMapGroupSize, ++colorMapGroupSizes[colorMap.group]);
			if(colorMapGroupIndices[colorMap.group] == null)
				colorMapGroupIndices[colorMap.group] = i++;
		}
		
		var headerRow = tableColorMapPicker.createTHead().insertRow(-1);
		for(var colorMapGroupName in colorMapGroupSizes)
		{
			//headerRow.insertCell(-1).innerHTML = "<b>" + colorMapGroupName + "</b>";
			var th = document.createElement('th');
			th.innerHTML = colorMapGroupName;
			headerRow.appendChild(th);
			if(colorMapGroupName == "Solid")
				th.style.width = "50px";
		}
		
		var tbody = tableColorMapPicker.createTBody();
		var rows = [];
		for(var i = 0; i < maxColorMapGroupSize; ++i)
		{
			var row = tbody.insertRow(-1);
			var cells;
			rows.push(cells = []);
			for(var colorMapGroupName in colorMapGroupSizes)
				cells.push(row.insertCell(-1));
		}
		var rowIndices = [];
		for(var colorMapName in colorMaps)
		{
			if(colorMapName === '_default' || colorMaps[colorMapName].inPicker === false)
				continue;
			
			var colorMap = colorMaps[colorMapName];
			var isSolid = colorMap.group == "Solid";
			
			var canvas = document.createElement('canvas');
			canvas.id = isSolid ? "tableColorMapPicker_canvas_s" : "tableColorMapPicker_canvas"
			canvas.width = COLOR_MAP_SIZE;
			canvas.height = 1;
			canvas.tag_id = colorMapName;
			canvas.draggable = "true";
			canvas.ondragstart = colorMap_onDragStart;
			canvas.ondragend = colorMap_onDragEnd;
			
			var ctx = canvas.getContext("2d");
			var imgdata = ctx.getImageData(0, 0, COLOR_MAP_SIZE, 1);
			for(var i = 0; i < colorMap.bytes.length; ++i)
				imgdata.data[i] = colorMap.bytes[i];
			for(var x = 0; x < COLOR_MAP_SIZE; x += Math.floor(colorMap.bytes.length / 4))
				ctx.putImageData(imgdata, x, 0);
			
			// Draw splitters
			if(colorMap.splitters)
				for(var i = 2; i < colorMap.splitters.length; ++i)
				{
					var x = colorMap.splitters[i].pos * COLOR_MAP_SIZE;
					ctx.fillStyle="#FFFFFF";
					ctx.fillRect(x - COLOR_MAP_SIZE / 200, 0, COLOR_MAP_SIZE / 200, 1);
					ctx.fillStyle="#000000";
					ctx.fillRect(x, 0, COLOR_MAP_SIZE / 100, 1);
				}
			
			var label = document.createElement('label');
			label.id = "tableColorMapPicker_label";
			label.innerHTML = colorMapName;
			
			if(!isSolid)
			{
				/*var button = document.createElement('button');
				button.innerHTML = "Flip";
				button.tag_canvas = canvas;
				button.tag_colorMap = colorMap;
				button.onclick = colorMap_onFlipClick;*/
				var button = document.createElement('input');
				button.id = "tableColorMapPicker_button";
				button.type = "image";
				button.src = "flipButton.png"
				button.tag_canvas = canvas;
				button.tag_colorMap = colorMap;
				button.onclick = colorMap_onFlipClick;
			}
			
			if(rowIndices[colorMap.group] == null)
				rowIndices[colorMap.group] = 0;
			var cells = rows[rowIndices[colorMap.group]++];
			var cell = cells[colorMapGroupIndices[colorMap.group]];
			if(!isSolid)
				cell.appendChild(button);
			cell.appendChild(canvas);
			cell.appendChild(label);
		}
	}
}