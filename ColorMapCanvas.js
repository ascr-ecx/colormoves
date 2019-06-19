var isFirefox = typeof InstallTrigger !== 'undefined';

CURSOR_DEFAULT = 'auto';
CURSOR_MOVE_HIST = 'move';
CURSOR_MOVE_PIN = 'col-resize';
CURSOR_MOVE_ALPHA = 'row-resize';
CURSOR_OVER_CROP = isFirefox ? 'grab' : 'pointer';
CURSOR_MOVE_CROP = isFirefox ? 'grabbing' : 'ew-resize';

// >>> Options
ALPHA_MODE = 'SECTION';
//ALPHA_MODE = 'SPLITTER';
ENABLE_HIGHLIGHT_LABEL = false;


function ColorMapCanvas(canvas, div, divBounds)
{
	this.canvas = canvas;
	this.div = div;
	var gl = webGLStart(canvas);

	gl.enable(gl.BLEND);
	gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA); // Blend function: finalcolor = oldcolor + newcolor * newalpha
	
	var sdr = initShader(gl, "vsSimple", "fsColorMap");
	var sdrAlpha = initShader(gl, "vsAlpha", "fsColorMap");
	var sdrSimple = initShader(gl, "vsSimple", "fsSimple");
	var sdrLine = initShader(gl, "vsSimple", "fsLine");
	var sdrAlphaLine = initShader(gl, "vsAlpha", "fsLine");
	var sdrHighlight = initShader(gl, "vsSimple", "fsHighlight");
	var texSplitter = LoadTexture(gl, "splitter.png");
	var texInterjectorLeft = LoadTexture(gl, "interjectorLeft.png");
	var texInterjectorRight = LoadTexture(gl, "interjectorRight.png");
	var texDragPoint = LoadTexture(gl, "dragPoint.png", function() {requestAnimFrame(render);});
	var texDragPointHighlighted = LoadTexture(gl, "dragPoint_h.png");
	var meshQuad = CreateQuadMesh(gl);
	var meshLineQuad = CreateLineQuadMesh(gl);
	var meshGrid = CreateGridMesh(gl);
	var meshHistogramLines = [];
	var meshHistogram = meshQuad;
	var meshAlphaCurve = null, meshAlphaCurveLine = null;
	
	var sections = [], splitters = [];
	var minValue, maxValue, valueSuffix;
	var highlightArea = null;
	var dragPointSection = null, dragPoint = null, dragOffset, dragOffset2;
	
	var xr, yr;
	
	actionManager.register('InsertSplitterPin', InsertSplitterPin, RemoveSplitter, UndoRemoveSplitter);
	actionManager.register('InsertNestedPin', InsertNestedPin, RemoveSplitter, UndoRemoveSplitter);
	actionManager.register('RemoveSplitter', RemoveSplitter, UndoRemoveSplitter);
	actionManager.register('MoveSplitter', MoveSplitter, MoveSplitter);
	actionManager.register('MoveAlpha', MoveAlpha, MoveAlpha);
	actionManager.register('CropSection', CropSection, CropSection);
	actionManager.register('SetSectionColormap', SetSectionColormap, ReplaceSectionsAndSplitters, ReplaceSectionsAndSplitters);//SetSectionColormap, SetSectionColormap);
	actionManager.register('LoadColormap', LoadColormap, UndoLoadColormap);
	
	RegisterMouseHandler(this, canvas);

	var highlightRect = new function()
	{
		var rect = document.createElement("div");
		rect.id = "ImageFrame";
		rect.style.left = 0;
		rect.style.top = 0;
		rect.style.width = "100%";
		rect.style.height = "100%";
		divBounds.appendChild(rect);

		this.show = function() { rect.style.display = "inline-block"; }
		this.hide = function() { rect.style.display = "none"; }
	};
	function showHighlight() { highlightRect.show(); }
	function hideHighlight() { highlightRect.hide(); }

	var highlightLine = document.createElement("div");
	highlightLine.id = "HighlightLine";
	divBounds.appendChild(highlightLine);

	if(ENABLE_HIGHLIGHT_LABEL)
	{
		var highlightLineLabel = document.createElement("div");
		highlightLineLabel.id = "HighlightLineLabel";
		highlightLine.appendChild(highlightLineLabel);
	}

	var transform = mat4.create(), invtransform = mat4.create();
	var showHistogram = true, showAlphaCurve = true;
	function render()
	{
		gl.clear(gl.COLOR_BUFFER_BIT);
		
		var mattrans = mat4.create();
		mat4.identity(mattrans);
		mat4.mul(mattrans, mattrans, transform);
		mat4.translate(mattrans, mattrans, [-1.0, -0.98, 0.0]);
		mat4.scale(mattrans, mattrans, [2.0, 0.197, 1.0]);
		
		var mattrans_static = mat4.create();
		mat4.identity(mattrans_static);
		mat4.translate(mattrans_static, mattrans_static, [-1.0, -0.98, 0.0]);
		mat4.scale(mattrans_static, mattrans_static, [2.0, 0.197, 1.0]);
		
		if(showHistogram && meshHistogram != null)
		{
			gl.useProgram(sdr);
setColorMap(gl, sdr, sections, function(section) {return section.colorMap.texCM}); // Bugfix
			gl.uniformMatrix4fv(sdr.matWorldViewProjUniform, false, mattrans);
			meshHistogram.bind(sdr, null);
			meshHistogram.draw();
		}
		if(showAlphaCurve && meshAlphaCurve != null)
		{
			gl.useProgram(sdrAlpha);
setColorMap(gl, sdrAlpha, sections, function(section) {return section.colorMap.texCM}); // Bugfix
			gl.uniformMatrix4fv(sdrAlpha.matWorldViewProjUniform, false, mattrans_static);
			gl.uniformMatrix4fv(sdrAlpha.matTexCoordTransformUniform, false, invtransform);
			meshAlphaCurve.bind(sdrAlpha, null);
			meshAlphaCurve.draw();
		}
		
		gl.useProgram(sdrLine);
		gl.uniformMatrix4fv(sdrLine.matWorldViewProjUniform, false, mattrans);
		gl.uniform4f(sdrLine.colorUniform, 0.5, 0.5, 0.5, 1.0);
		meshGrid.bind(sdrLine, null);
		meshGrid.draw();
		if(showHistogram && meshHistogramLines.length !== 0)
		{
			gl.uniform4f(sdrLine.colorUniform, 0.0, 0.0, 0.0, 1.0);
			meshHistogramLines.forEach(function(line) {
				line.bind(sdrLine, null);
				line.draw();
			});
		}
		
		if(showAlphaCurve && meshAlphaCurveLine != null)
		{
			gl.useProgram(sdrAlphaLine);
setColorMap(gl, sdrAlphaLine, sections, function(section) {return section.colorMap.texCM}); // Bugfix
			gl.uniformMatrix4fv(sdrAlphaLine.matWorldViewProjUniform, false, mattrans_static);
			gl.uniformMatrix4fv(sdrAlphaLine.matTexCoordTransformUniform, false, invtransform);
			gl.uniform4f(sdrAlphaLine.colorUniform, 0.0, 0.0, 0.0, 1.0);
			meshAlphaCurveLine.bind(sdrAlphaLine, null);
			meshAlphaCurveLine.draw();
		}
		
		if(highlightArea != null)
		{
			gl.useProgram(sdrHighlight);
			meshQuad.bind(sdrHighlight, null);
			
			mat4.identity(mattrans);
			mat4.mul(mattrans, mattrans, transform);
			mat4.translate(mattrans, mattrans, [2.0 * highlightArea[0] - 1.0, -0.98, 0.0]);
			mat4.scale(mattrans, mattrans, [(highlightArea[1] - highlightArea[0]) * 2.0, 1.97, 1.0]);
			gl.uniformMatrix4fv(sdrHighlight.matWorldViewProjUniform, false, mattrans);
			
			meshQuad.draw();
		}
		
		gl.enable(gl.BLEND);
		splitters.forEach(function(splitter) {
			if(!splitter.fixed)
			{
				if(splitter.left === null)
					drawSplitter(splitter.pos, texInterjectorLeft);
				else if(splitter.right === null)
					drawSplitter(splitter.pos, texInterjectorRight);
				else
					drawSplitter(splitter.pos, texSplitter);
			}
		});
		
		if(dragPointSection != null)
			drawDragPoints(dragPointSection);
		
		if(dragPointSection != null && canvas.style.cursor == CURSOR_MOVE_CROP)
		{
			gl.useProgram(sdrHighlight);
			meshLineQuad.bind(sdrHighlight, null);
			
			var start = dragPointSection.start.pos + dragPointSection.startValue * (dragPointSection.end.pos - dragPointSection.start.pos);
			var end = dragPointSection.start.pos + dragPointSection.endValue * (dragPointSection.end.pos - dragPointSection.start.pos);
			
			mat4.identity(mattrans);
			mat4.mul(mattrans, mattrans, transform);
			mat4.translate(mattrans, mattrans, [2.0 * start - 1.0, -0.98, 0.0]);
			mat4.scale(mattrans, mattrans, [(end - start) * 2.0, 0.197, 1.0]);
			gl.uniformMatrix4fv(sdrHighlight.matWorldViewProjUniform, false, mattrans);
			
			gl.lineWidth(4.0);
			meshLineQuad.draw();
			gl.lineWidth(1.0);
		}
	}
	
	function drawSplitter(pos, tex) // pos = 0.0 ... 1.0
	{
		gl.useProgram(sdrSimple);
		
		var vpos = vec3.create();
		vec3.transformMat4(vpos, [2.0 * pos - 1.0, -1.0, 0.0], transform);
		
		var mattrans = mat4.create();
		mat4.identity(mattrans);
		mat4.translate(mattrans, mattrans, vpos);
		mat4.scale(mattrans, mattrans, [tex.image.width / gl.viewportWidth, tex.image.height / gl.viewportHeight, 1.0]);
		mat4.translate(mattrans, mattrans, [-0.5, 0.0, 0.0]);
		gl.uniformMatrix4fv(sdrSimple.matWorldViewProjUniform, false, mattrans);
		
		meshQuad.bind(sdrSimple, tex);
		meshQuad.draw();
	}
	
	function drawDragPoints(section)
	{
		gl.useProgram(sdrSimple);
		
		var vpos = vec3.create();
		var mattrans = mat4.create();
		
		if(dragPoint != 'end' || canvas.style.cursor != CURSOR_MOVE_CROP)
		{
			if(dragPoint == 'start' && canvas.style.cursor == CURSOR_MOVE_CROP)
			{
				var start = dragPointSection.start.pos + dragPointSection.startValue * (dragPointSection.end.pos - dragPointSection.start.pos);
				start += dragOffset2;
				vec3.transformMat4(vpos, [2.0 * start - 1.0, -0.95, 0.0], transform);
			}
			else
			{
				vec3.transformMat4(vpos, [2.0 * dragPointSection.start.pos - 1.0, -0.95, 0.0], transform);
				vpos[0] += 32.0 / gl.viewportWidth;
			}
			
			mat4.identity(mattrans);
			mat4.translate(mattrans, mattrans, vpos);
			mat4.scale(mattrans, mattrans, [texDragPoint.image.width / gl.viewportWidth, texDragPoint.image.height / gl.viewportHeight, 1.0]);
			mat4.translate(mattrans, mattrans, [-0.5, 0.0, 0.0]);
			gl.uniformMatrix4fv(sdrSimple.matWorldViewProjUniform, false, mattrans);
			meshQuad.bind(sdrSimple, dragPoint == 'start' ? texDragPointHighlighted : texDragPoint);
			meshQuad.draw();
		}
		
		if(dragPoint != 'start' || canvas.style.cursor != CURSOR_MOVE_CROP)
		{
			if(dragPoint == 'end' && canvas.style.cursor == CURSOR_MOVE_CROP)
			{
				var end = dragPointSection.start.pos + dragPointSection.endValue * (dragPointSection.end.pos - dragPointSection.start.pos);
				end += dragOffset2;
				vec3.transformMat4(vpos, [2.0 * end - 1.0, -0.95, 0.0], transform);
			}
			else
			{
				vec3.transformMat4(vpos, [2.0 * dragPointSection.end.pos - 1.0, -0.95, 0.0], transform);
				vpos[0] -= 32.0 / gl.viewportWidth;
			}
			
			mat4.identity(mattrans);
			mat4.translate(mattrans, mattrans, vpos);
			mat4.scale(mattrans, mattrans, [texDragPoint.image.width / gl.viewportWidth, texDragPoint.image.height / gl.viewportHeight, 1.0]);
			mat4.translate(mattrans, mattrans, [-0.5, 0.0, 0.0]);
			gl.uniformMatrix4fv(sdrSimple.matWorldViewProjUniform, false, mattrans);
			meshQuad.bind(sdrSimple, dragPoint == 'end' ? texDragPointHighlighted : texDragPoint);
			meshQuad.draw();
		}
	}
	
	this.onResize = function()
	{
		gl.viewportWidth = canvas.width = div.offsetWidth - 2 * parseInt(canvas.style.left);
		gl.viewportHeight = canvas.height = div.offsetHeight - 2 * parseInt(canvas.style.top);
		gl.viewport(0, 0, gl.viewportWidth, gl.viewportHeight);

		divBounds.style.left = canvas.offsetLeft;
		divBounds.style.top = canvas.offsetTop;
		divBounds.style.width = canvas.offsetWidth;
		divBounds.style.height = canvas.offsetHeight;

		repositionHistogramLabels();
		recreateAlphaCurveMeshes();
		requestAnimFrame(render);
	}
	this.onResize();
	
	function repositionHistogramLabels()
	{
		var v = vec3.create();
		for(var i = 0; i <= 10; ++i)
		{
			vec3.transformMat4(v, [-1.0 + 0.2 * i, 0.0, 0.0], transform);
			var left = 75.5 + (v[0] + 1.0) * canvas.width / 2;
			if(50 < left && left < canvas.width + 100)
			{
				lblHistogramH[i].style.visibility = 'visible';
				lblHistogramH[i].style.left = 35.5 + (v[0] + 1.0) * canvas.width / 2;

				lblHistogramV[i].style.top = canvas.height * (0.905 - 0.088 * i) + 6.0;
				lblHistogramV[i].style.visibility = canvas.height > 80 ? 'visible' : 'hidden';
			}
			else
				lblHistogramH[i].style.visibility = 'hidden';
		}
	}
	
	function recreateAlphaCurveMeshes()
	{
		if(meshAlphaCurve)
			meshAlphaCurve.free();
		if(meshAlphaCurveLine)
			meshAlphaCurveLine.free();
		
		var positions = [];
		for(var i = 0; i <= canvas.width; ++i)
			[].push.apply(positions, [i / (canvas.width - 1), 1.0, 0.0]);
		meshAlphaCurveLine = new Mesh(gl, positions, null, null, null, null, null, gl.LINE_STRIP);
		positions = [];
		for(var i = 0; i < canvas.width; ++i)
		{
			var x = i / (canvas.width - 1);
			[].push.apply(positions, [x, 1.0, 0.0]);
			[].push.apply(positions, [x, 0.0, 0.0]);
		}
		meshAlphaCurve = new Mesh(gl, positions);
	}
	
	function updateDragPointDisplay()
	{
		if(xr === null || yr === null || startsWith(canvas.style.cursor, 'url') || dragSplitter !== null)
			return;
		
		var oldDragPointSection = dragPointSection;
		dragPointSection = null;
		
		var oldDragPoint = dragPoint;
		dragPoint = null;
		
		// Set move mouse cursor if a splitter is close to xr
		var tolearance = 5.0 * invtransform[0] / canvas.width; // Grab tolerance is +- 5 pixels
		/*var splitterIdx;
		for(splitterIdx = 0; splitterIdx < splitters.length; ++splitterIdx)
			if(Math.abs(splitters[splitterIdx].pos - xr) < tolearance)
				break;*/
		var closestSplitterIdx = -1;
		var closestSplitterDistance = tolearance;
		for(var splitterIdx = 0; splitterIdx < splitters.length; ++splitterIdx)
			if(/*!splitters[splitterIdx].fixed &&*/ Math.abs(splitters[splitterIdx].pos - xr) < closestSplitterDistance)
			{
				closestSplitterDistance = Math.abs(splitters[splitterIdx].pos - xr);
				closestSplitterIdx = splitterIdx;
			}
		
		if(closestSplitterIdx == -1)
		{
			// Get section under mouse cursor
			sections.forEach(function(section) {
				if(dragPointSection == null && section.start.pos < xr && xr < section.end.pos)
					dragPointSection = section;
			});
			if(dragPointSection != null)
			{
				if(showAlphaCurve && ALPHA_MODE === 'SECTION')
				{
					var sxr = (xr - dragPointSection.start.pos) / (dragPointSection.end.pos - dragPointSection.start.pos); // Compute relative position within section
					var sar = (1 - sxr) * dragPointSection.startAlpha + sxr * dragPointSection.endAlpha; // Compute relative alpha within section (= alpha at mouse position)
					var y_sar = 0.9 - 0.9 * sar; // Compute pixel position of sar
					var tolearance_y = 16.0 / (2.0 * canvas.height); // Grab tolerance is +- 16 pixels
					if(Math.abs(y_sar - yr) < tolearance_y)
					{
						canvas.style.cursor = CURSOR_MOVE_ALPHA;
						return; //EDIT
					}
				}

				// Show drag points on section underneath mouse cursor
				var sectionwidth = (dragPointSection.end.pos - dragPointSection.start.pos) * canvas.width / invtransform[0]; // Compute visible section width in pixels
				if(sectionwidth >= 56.0) // 56 = 2 * drag_point_width (16 pixels) + 3 * drag_point_distance (8 pixels)
				{
					var tolearance_x = 16.0 * invtransform[0] / canvas.width, tolearance_y = 16.0 / (2.0 * canvas.height); // Grab tolerance is +- 16 pixels
					
					// Set move grab cursor if a drag point is close to xr
					if(Math.abs(dragPointSection.end.pos - xr - 8.0 * invtransform[0] / gl.viewportWidth) < tolearance_x && Math.abs(0.95 - yr) < tolearance_y)
					{
						dragPoint = 'end';
						canvas.style.cursor = CURSOR_OVER_CROP;
					}
					else if(Math.abs(dragPointSection.start.pos - xr + 8.0 * invtransform[0] / gl.viewportWidth) < tolearance_x && Math.abs(0.95 - yr) < tolearance_y)
					{
						dragPoint = 'start';
						canvas.style.cursor = CURSOR_OVER_CROP;
					}
					else
						canvas.style.cursor = CURSOR_DEFAULT;
				}
				else
					dragPointSection = null;
			}
		}
		else
		{
			var splitterAlpha = 0.0;
			if(splitters[closestSplitterIdx].left != null)
				splitterAlpha = splitters[closestSplitterIdx].left.endAlpha;
			else if(splitters[closestSplitterIdx].right != null)
				splitterAlpha = splitters[closestSplitterIdx].right.startAlpha;
			var y_splitterAlpha = 0.9 - 0.9 * splitterAlpha; // Compute pixel position of splitterAlpha
			
			var tolearance_y = 16.0 / (2.0 * canvas.height); // Grab tolerance is +- 16 pixels
			if(showAlphaCurve && ALPHA_MODE === 'SPLITTER' && Math.abs(y_splitterAlpha - yr) < tolearance_y)
				canvas.style.cursor = CURSOR_MOVE_ALPHA;
			else if(!splitters[closestSplitterIdx].fixed)
				canvas.style.cursor = CURSOR_MOVE_PIN;
		}
		
		if(dragPointSection != oldDragPointSection || dragPoint != oldDragPoint)
			requestAnimFrame(render);
	}

	this.setValueRange = function(min, max, suffix)
	{
		if(suffix === null)
			suffix = "";
		// Convert string to number
		min = min * 1;
		max = max * 1;
		minValue = min;
		maxValue = max;
		valueSuffix = suffix;

		for(var i = 0; i <= 10; ++i)
			lblHistogramH[i].innerHTML = "" + (min + i * (max - min) / 10.0).toPrecision(3) + suffix;
	}
	this.setValueRange(0, 100, '%');
	
	this.showHistogram = function()
	{
		showHistogram = true;
		requestAnimFrame(render);
	}
	this.hideHistogram = function()
	{
		showHistogram = false;
		requestAnimFrame(render);
	}
	this.showAlphaCurve = function()
	{
		showAlphaCurve = true;
		requestAnimFrame(render);
	}
	this.hideAlphaCurve = function()
	{
		showAlphaCurve = false;
		requestAnimFrame(render);
	}
	
	function onDragOver(event)
	{
		if(event.dataTransfer.types == null)
			return;
		for(var i = 0; i < event.dataTransfer.types.length; ++i)
			if(event.dataTransfer.types[i] === 'colormapname')
			{
				//console.log("event.dataTransfer.types[i] = " + event.dataTransfer.types[i]);
				event.preventDefault();
				var canvasBounds = canvas.getBoundingClientRect();
				var xr = (event.clientX - canvasBounds.left) / canvas.width;
				
				var vpos = vec3.create();
				vec3.transformMat4(vpos, [2.0 * xr - 1.0, 0.0, 0.0], invtransform);
				xr = vpos[0] / 2.0 + 0.5;

				var done = false;
				sections.forEach(function(section) {
					if(!done && section.start.pos < xr && xr < section.end.pos)
					{
						highlightArea = [section.start.pos, section.end.pos];
						requestAnimFrame(render);
						done = true;
					}
				});
				return;
			}
			else if(event.dataTransfer.types[i] === 'Files')
			{
				event.preventDefault();
				showHighlight();
				return;
			}
	}
	canvas.ondragover = onDragOver;
	function onDragLeave(event)
	{
		if(highlightArea != null)
		{
			highlightArea = null;
			requestAnimFrame(render);
		}
		hideHighlight();
	}
	canvas.ondragleave = onDragLeave;
	function onDrop(event)
	{
		event.preventDefault();
		hideHighlight();

		var colorMap = colorMaps[event.dataTransfer.getData('ColorMapName')];
		if(colorMap)
		{
			//hideColorPicker();
			highlightArea = null;
			
			var canvasBounds = canvas.getBoundingClientRect();
			var xr = (event.clientX - canvasBounds.left) / canvas.width;
			
			var vpos = vec3.create();
			vec3.transformMat4(vpos, [2.0 * xr - 1.0, 0.0, 0.0], invtransform);
			xr = vpos[0] / 2.0 + 0.5;
			
			var done = false; 
			var sectionIdx = 0;
			sections.forEach(function(section) {
				if(!done && section.start.pos <= xr && xr < section.end.pos)
				{
					actionManager.perform('SetSectionColormap', {sectionIdx: sectionIdx, colormap: colorMap, flipped: colorMap.flipped});
					done = true;
				}
				++sectionIdx;
			});
			return;
		}

		var files = (event.files || event.dataTransfer.files);
		if(files && files.length === 1 && files[0].type === 'text/xml')
		{
			var reader = new FileReader();
			reader.onload = function(e) {
				readColorMapsFromXml(this.result, COLOR_MAP_SIZE, onDroppedColorMapLoaded);
			};
			reader.readAsDataURL(files[0]);
			return;
		}
	}
	canvas.ondrop = onDrop;

	function onDragOverTrash(event)
	{
		if(event.dataTransfer.types != null)
			for(var i = 0; i < event.dataTransfer.types.length; ++i)
				if(event.dataTransfer.types[i] === 'colormapname')
				{
					event.preventDefault();
					return;
				}
	}
	document.getElementById('cmdTrash1').ondragover = onDragOver;
	document.getElementById('cmdTrash2').ondragover = onDragOver;
	function onDropIntoTrash(event)
	{
		var colorMap = colorMaps[event.dataTransfer.getData('ColorMapName')];
		if(colorMap)
		{
			event.preventDefault();
			//hideColorPicker();
			
			colorMap.inPicker = false; //EDIT: Remove colormap if not in use by colormap canvas or other colormaps
			colormapPicker.recreatePicker();
		}
	}
	document.getElementById('cmdTrash1').ondrop = onDropIntoTrash;
	document.getElementById('cmdTrash2').ondrop = onDropIntoTrash;

	function onDroppedColorMapLoaded(newColorMaps)
	{
		// Handle only first colormap
		var colormap = newColorMaps._default;
		if(!colormap)
			return;
		
		actionManager.perform('LoadColormap', colormap);
	}
	
	this.loadColorMapTextures = function()
	{
		var i = 0;
		for(var colorMapName in colorMaps)
		{
			if(colorMapName === '_default' || colorMaps[colorMapName].texCM != null)
				continue;

			if(colorMaps[colorMapName].texCM == null)
				colorMaps[colorMapName].texCM = LoadTextureFromByteArray(gl, new Uint8Array(colorMaps[colorMapName].bytes), colorMaps[colorMapName].bytes.length / 4, 1);
		}
		
		if(sections.length === 0 && colorMaps._default != null)
		{
			splitters = [
				{fixed: true, pos: 0.0, left: null, right: null},
				{fixed: true, pos: 1.0, left: null, right: null}
			];
			sections = [
				{
					colorMap: colorMaps._default,
					start: splitters[0],
					end: splitters[1],
					startValue: 0.0,
					endValue: 1.0,
					flipped: false,
					startAlpha: 1.0,
					endAlpha: 1.0
				}
			];
			splitters[0].right = splitters[1].left = sections[0];
		}
		onColorTableChanged(sections);
	}
	
	this.updateHistogram = function(histograms)
	{
		meshHistogramLines.length = 0;
		if (histograms.length === 0)
			return;
		var size = histograms[0].values.length;
		var maxPercentage = 0;
		histograms.forEach(function(histogram) {
			// Make sure histogram.values.length matches between histograms
			if (histogram.values.length != size)
				assert("Histograms can't have different resolutions");
			
			// Find overall max-percentage
			maxPercentage = Math.max(maxPercentage, histogram.maxPercentage);

			// Create line mesh from histogram
			var positions = [], texcoords = [];
			for(var i = 0; i <= size; ++i)
			{
				var x = i / (size - 1);
				var y = 1.0 + 9.0 * histogram.values[i];
				
				[].push.apply(positions, [x, y, 0.0]);
			}
			meshHistogramLines.push(new Mesh(gl, positions, null, null, null, null, null, gl.LINE_STRIP));
		});

		// Create filled mesh from histograms
		var positions = [], texcoords = [];
		var maxValue;
		for(var i = 0; i < size; ++i)
		{
			maxValue = 0;
			histograms.forEach(function(histogram) {
				maxValue = Math.max(maxValue, histogram.values[i]);
			});

			var x0 = i / (size - 1), x1 = (i + 1) / (size - 1);
			var y0 = 0.0, y1 = 1.0 + 9.0 * maxValue;
			
			[].push.apply(positions, [x0, y1, 0.0]);
			[].push.apply(positions, [x0, y0, 0.0]);
			[].push.apply(texcoords, [x0, 0.5]);
			[].push.apply(texcoords, [x0, 0.5]);
		}
		meshHistogram = new Mesh(gl, positions, null, null, null, texcoords);
		requestAnimFrame(render);

		// Update histgram labels based on maxPercentage
		for(var i = 0; i <= 10; ++i)
			lblHistogramV[i].innerHTML = (10.0 * i * maxPercentage).toFixed(3) + "%";
	}
	
	this.setColorMap = function(sections)
	{
		setColorMap(gl, sdr, sections, function(section) {return section.colorMap.texCM});
		requestAnimFrame(render);
	}

	this.showTrashButtons = function()
	{
		document.getElementById('cmdSplitter').style.display = 'none';
		document.getElementById('cmdInterjector').style.visibility = 'hidden';
		document.getElementById('divUndoRedo').style.visibility = 'hidden';
		document.getElementById('cmdTrash1').style.display = display = 'inline-block';
		
		document.getElementById('cmdColormap').style.display = 'none';
		document.getElementById('cmdSaveColormap').style.visibility = 'hidden';
		document.getElementById('cmdHistogram').style.visibility = 'hidden';
		document.getElementById('cmdAlpha').style.visibility = 'hidden';
		document.getElementById('cmdHistogramAlpha').style.visibility = 'hidden';
		document.getElementById('cmdTrash2').style.display = display = 'inline-block';
	}
	this.hideTrashButtons = function()
	{
		document.getElementById('cmdTrash1').style.display = display = 'none';
		document.getElementById('cmdSplitter').style.display = 'inline-block';
		document.getElementById('cmdInterjector').style.visibility = 'visible';
		document.getElementById('divUndoRedo').style.visibility = 'visible';
		
		document.getElementById('cmdTrash2').style.display = display = 'none';
		document.getElementById('cmdColormap').style.display = 'inline-block';
		document.getElementById('cmdSaveColormap').style.visibility = 'visible';
		document.getElementById('cmdHistogram').style.visibility = 'visible';
		document.getElementById('cmdAlpha').style.visibility = 'visible';
		document.getElementById('cmdHistogramAlpha').style.visibility = 'visible';
	}
	
	var dragSplitter = null, dragSection = null, dragBoundsLeft, dragBoundsRight, dragStartPos, dragStartAlpha;
	var tmd0 = vec3.create();
	this.onMouseDown = function(canvas, clientX, clientY, which)
	{
		if(which != 1)
			return;
		
		// Trigger mouse move event to make sure everything is set up for a mouse down at the current location
		this.onMouseMove(canvas, clientX, clientY, [true, false, false]);
		
		var xr = clientX / canvas.width;
		
		if(canvas.style.cursor == CURSOR_MOVE_PIN)
		{
			var vpos = vec3.create();
			vec3.transformMat4(vpos, [2.0 * xr - 1.0, 0.0, 0.0], invtransform);
			xr = vpos[0] / 2.0 + 0.5;
			
			this.showTrashButtons();
			
			var dragSplitterDistance = Number.MAX_VALUE;
			splitters.forEach(function(splitter) {
				if(!splitter.fixed && Math.abs(splitter.pos - xr) < dragSplitterDistance)
				{
					dragSplitterDistance = Math.abs(splitter.pos - xr);
					dragSplitter = splitter;
				}
			});
			dragBoundsLeft = dragSplitter.left !== null ? dragSplitter.left.start.pos : 0.0;
			dragBoundsRight = dragSplitter.right !== null ? dragSplitter.right.end.pos : 1.0;
			dragStartPos = dragSplitter.pos;
			/*splitters.forEach(function(splitter) {
				if(splitter !== dragSplitter)
				{
					if(splitter.pos < dragSplitter.pos)
						dragBoundsLeft = Math.max(dragBoundsLeft, splitter.pos);
					else
						dragBoundsRight = Math.min(dragBoundsRight, splitter.pos);
				}
			});
			console.log(dragBoundsLeft + " - " + dragBoundsRight);*/
		}
		else if(canvas.style.cursor == CURSOR_MOVE_ALPHA && ALPHA_MODE === 'SPLITTER')
		{
			var vpos = vec3.create();
			vec3.transformMat4(vpos, [2.0 * xr - 1.0, 0.0, 0.0], invtransform);
			xr = vpos[0] / 2.0 + 0.5;
			
			var dragSplitterDistance = Number.MAX_VALUE;
			splitters.forEach(function(splitter) {
				if(Math.abs(splitter.pos - xr) < dragSplitterDistance)
				{
					dragSplitterDistance = Math.abs(splitter.pos - xr);
					dragSplitter = splitter;
				}
			});
			dragStartAlpha = 0.0;
			if(dragSplitter.left != null)
				dragStartAlpha = dragSplitter.left.endAlpha;
			else if(dragSplitter.right != null)
				dragStartAlpha = dragSplitter.right.startAlpha;
		}
		else if(canvas.style.cursor == CURSOR_MOVE_ALPHA && ALPHA_MODE === 'SECTION')
		{
			dragSection = dragPointSection;
			dragStartAlpha = [dragSection.startAlpha, dragSection.endAlpha];
		}
		else if(canvas.style.cursor == CURSOR_OVER_CROP)
		{
			var vpos = vec3.create();
			vec3.transformMat4(vpos, [2.0 * xr - 1.0, 0.0, 0.0], invtransform);
			xr = vpos[0] / 2.0 + 0.5;
			
			xr = (xr - dragPointSection.start.pos) / (dragPointSection.end.pos - dragPointSection.start.pos);
			if(dragPoint == 'start')
			{
				dragStartPos = dragPointSection.startValue;
				dragOffset = xr - dragPointSection.startValue;
				dragOffset2 = (16.0 * invtransform[0] / gl.viewportWidth) - dragPointSection.startValue * (dragPointSection.end.pos - dragPointSection.start.pos);
			}
			else if(dragPoint == 'end')
			{
				dragStartPos = dragPointSection.endValue;
				dragOffset = xr - dragPointSection.endValue;
				dragOffset2 =  (1.0 - dragPointSection.endValue) * (dragPointSection.end.pos - dragPointSection.start.pos) - (16.0 * invtransform[0] / gl.viewportWidth);
			}

			canvas.style.cursor = CURSOR_MOVE_CROP;
			requestAnimFrame(render); // Redraw to hide drag points
		}
		else if(startsWith(canvas.style.cursor, 'url'))
		{
			var vpos = vec3.create();
			vec3.transformMat4(vpos, [2.0 * xr - 1.0, 0.0, 0.0], invtransform);
			xr = vpos[0] / 2.0 + 0.5;
			
			// Find section containing xr
			var sectionIdx;
			for(sectionIdx = 0; sectionIdx < sections.length; ++sectionIdx)
				if(sections[sectionIdx].start.pos < xr && xr <= sections[sectionIdx].end.pos)
					break;
			if(sectionIdx == sections.length)
				return;
			
			if(canvas.style.cursor.indexOf('splitterCursor') != -1)
				actionManager.perform('InsertSplitterPin', xr);
			else
				actionManager.perform('InsertNestedPin', xr);
			
			if(!ctrlPressed)
				canvas.style.cursor = CURSOR_DEFAULT;
		}
		else
		{
			xr = 1.0 - 2.0 * xr;
			
			canvas.style.cursor = CURSOR_MOVE_HIST;

			var transform_noscale = mat4.create();
			mat4.copy(transform_noscale, transform);
			transform_noscale[0] = 1.0;
			
			vec3.transformMat4(tmd0, [xr, 0.0, 0.0], transform_noscale);
		}
	}
	
	function startsWith(str, s)
	{
		return str.lastIndexOf(s, 0) === 0;
	}
	
	this.onMouseMove = function(canvas, clientX, clientY, pressedmousebuttons)
	{
		xr = clientX / canvas.width;
		yr = clientY / canvas.height;
		var showHighlight = false;
		
		if(dragSplitter !== null && canvas.style.cursor == CURSOR_MOVE_PIN)
		{
			var vpos = vec3.create();
			vec3.transformMat4(vpos, [2.0 * xr - 1.0, 0.0, 0.0], invtransform);
			xr = vpos[0] / 2.0 + 0.5;
			
			//xr = Math.min(Math.max(xr, 0.0), 1.0);
			/*if(dragSplitter.left !== null)
				xr = Math.max(xr, dragSplitter.left.start.pos);
			if(dragSplitter.right !== null)
			{
				xr = Math.min(xr, dragSplitter.right.end.pos);
				console.log(dragSplitter.right.end.pos);
			}*/
			
			xr = Math.max(xr, dragBoundsLeft);
			xr = Math.min(xr, dragBoundsRight);
			
			MoveSplitter({splitter: dragSplitter, pos: xr});
		}
		else if(dragSplitter !== null && canvas.style.cursor == CURSOR_MOVE_ALPHA && ALPHA_MODE === 'SPLITTER')
		{
			// yr     alpha
			// 0.9 ... 0.0
			// 0.0 ... 1.0
			//1.0 - yr / 0.9
			//Math.min(1.0, Math.max(0.0, 1.0 - yr / 0.9)));
			MoveAlpha({splitter: dragSplitter, alpha: Math.min(1.0, Math.max(0.0, 1.0 - yr / 0.9))});
		}
		else if(dragSection !== null && canvas.style.cursor == CURSOR_MOVE_ALPHA && ALPHA_MODE === 'SECTION')
		{
			// yr     alpha
			// 0.9 ... 0.0
			// 0.0 ... 1.0
			//1.0 - yr / 0.9
			//Math.min(1.0, Math.max(0.0, 1.0 - yr / 0.9)));
			var newAlpha = Math.min(1.0, Math.max(0.0, 1.0 - yr / 0.9));
			MoveAlpha({section: dragSection, startAlpha: newAlpha, endAlpha: newAlpha});
		}
		else if(dragPointSection != null && canvas.style.cursor == CURSOR_MOVE_CROP)
		{
			var vpos = vec3.create();
			vec3.transformMat4(vpos, [2.0 * xr - 1.0, 0.0, 0.0], invtransform);
			xr = vpos[0] / 2.0 + 0.5;
			
			xr = (xr - dragPointSection.start.pos) / (dragPointSection.end.pos - dragPointSection.start.pos);
			xr -= dragOffset;
			
			if(dragPoint == 'start')
				CropSection({section: dragPointSection, startValue: Math.min(xr, 0.0), endValue: dragPointSection.endValue});
			else if(dragPoint == 'end')
				CropSection({section: dragPointSection, startValue: dragPointSection.startValue, endValue: Math.max(xr, 1.0)});
		}
		else if(startsWith(canvas.style.cursor, 'url'))
			showHighlight = true;
		else
		{
			if(canvas.style.cursor == CURSOR_MOVE_HIST)
			{
				xr = 1.0 - 2.0 * xr;
				
				var transform_noscale = mat4.create();
				mat4.copy(transform_noscale, transform);
				transform_noscale[0] = 1.0;
				
				var t0 = vec3.create(), tm = vec3.create(), tm0 = vec3.create();
				vec3.transformMat4(tm0, [xr, 0.0, 0.0], transform_noscale);
				vec3.transformMat4(t0, [0.0, 0.0, 0.0], transform_noscale);
				
				
				vec3.sub(tm0, tmd0, tm0);
				vec3.add(tm0, tm0, t0);
				
				vec3.transformMat4(tm0, tm0, invtransform);
				
				mat4.translate(transform, transform, tm0);
				restrictTransform(transform);
				mat4.invert(invtransform, transform);
				
				requestAnimFrame(render);
				repositionHistogramLabels();
			}
			else
			{
				var vpos = vec3.create();
				vec3.transformMat4(vpos, [2.0 * xr - 1.0, 0.0, 0.0], invtransform);
				xr = vpos[0] / 2.0 + 0.5;
				updateDragPointDisplay();
				
				showHighlight = true;
			}
		}
		
		
		if (showHighlight === true)
		{
			var _vpos = vec3.create();
			vec3.transformMat4(_vpos, [2.0 * xr - 1.0, 0.0, 0.0], invtransform);
			imageCanvas.highlightValue(_vpos[0] / 2.0 + 0.5);
			this.highlightValue(_vpos[0] / 2.0 + 0.5, clientX);
		}
		else
		{
			imageCanvas.highlightValue(null);
			this.highlightValue(null);
		}
	}

	this.onMouseLeave = function(canvas, clientX, clientY, pressedmousebuttons)
	{
		xr = yr = null;
		
		if(dragPointSection != null && canvas.style.cursor != CURSOR_MOVE_CROP)
		{
			dragPointSection = null;
			requestAnimFrame(render);
		}

		imageCanvas.highlightValue(null);
		this.highlightValue(null);
	}
	
	this.onMouseUp = function(canvas, clientX, clientY, which, target)
	{
		if(which == 1 && dragSplitter !== null && canvas.style.cursor == CURSOR_MOVE_PIN)
		{
			this.hideTrashButtons();
			
			var newpos = dragSplitter.pos;
			dragSplitter.pos = dragStartPos; // Use drag start position for undo
			if(target === document.getElementById('cmdTrash1')) // If splitter is released above trash1
				actionManager.perform('RemoveSplitter', {splitter: dragSplitter, removeRight: false});
			else if(target === document.getElementById('cmdTrash2')) // If splitter is released above trash2
				actionManager.perform('RemoveSplitter', {splitter: dragSplitter, removeRight: true});
			else
				actionManager.perform('MoveSplitter', {splitter: dragSplitter, pos: newpos});
			dragSplitter = null;
		}
		else if(which == 1 && dragSplitter !== null && canvas.style.cursor == CURSOR_MOVE_ALPHA && ALPHA_MODE === 'SPLITTER')
		{
			var newAlpha = 0.0;
			if(dragSplitter.left != null)
			{
				newAlpha = dragSplitter.left.endAlpha;
				dragSplitter.left.endAlpha = dragStartAlpha; // Use drag start alpha for undo
			}
			if(dragSplitter.right != null)
			{
				newAlpha = dragSplitter.right.startAlpha;
				dragSplitter.right.startAlpha = dragStartAlpha; // Use drag start alpha for undo
			}
			actionManager.perform('MoveAlpha', {splitter: dragSplitter, alpha: newAlpha});
			dragSplitter = null;
		}
		else if(which == 1 && dragSection !== null && canvas.style.cursor == CURSOR_MOVE_ALPHA && ALPHA_MODE === 'SECTION')
		{
			var newStartAlpha = dragSection.startAlpha, newEndAlpha = dragSection.endAlpha;
			dragSection.startAlpha = dragStartAlpha[0]; // Use drag start alpha for undo
			dragSection.endAlpha = dragStartAlpha[1]; // Use drag start alpha for undo
			actionManager.perform('MoveAlpha', {section: dragSection, startAlpha: newStartAlpha, endAlpha: newEndAlpha});
			dragSection = null;
		}
		else if(which == 1 && dragPointSection != null && canvas.style.cursor == CURSOR_MOVE_CROP)
		{
			var newStartValue = dragPointSection.startValue, newEndValue = dragPointSection.endValue;
			if(dragPoint == 'start')
				dragPointSection.startValue = dragStartPos; // Use drag start position for undo
			else if(dragPoint == 'end')
				dragPointSection.endValue = dragStartPos; // Use drag start position for undo
			actionManager.perform('CropSection', {section: dragPointSection, startValue: newStartValue, endValue: newEndValue});
			
			dragPointSection = null;
			requestAnimFrame(render);
		}
		else if(which == 1 && !startsWith(canvas.style.cursor, 'url'))
			canvas.style.cursor = 'default';
		
		// Trigger mouse move event to update cursor
		this.onMouseMove(canvas, clientX, clientY, [false, false, false]);
	}
	
	this.onMouseWheel = function(canvas, clientX, clientY, deltaZ, pressedmousebuttons)
	{
		var xr = 1.0 - 2.0 * clientX / canvas.width; // xr = mouse position in device space ([-1, 1])
	
		// >>> Mouse centered zoom
		// tm0 = vector from coordinate system center to mouse position in transform space
		// Algorithm:
		// 1) Translate image center to mouse cursor
		// 2) Zoom
		// 3) Translate back
		
		var transform_noscale = mat4.create();
		mat4.copy(transform_noscale, transform);
		transform_noscale[0] = 1.0; transform_noscale[5] = 1.0;
		
		var t0 = vec3.create(), tm = vec3.create(), tm0 = vec3.create(), tm0n = vec3.create();
		vec3.transformMat4(t0, [0.0, 0.0, 0.0], transform_noscale);
		vec3.transformMat4(tm, [xr, 0.0, 0.0], transform_noscale);
		vec3.sub(tm0, t0, tm);
		vec3.transformMat4(tm0, tm0, invtransform);
		vec3.negate(tm0n, tm0);
		
		var zoom = 1.0 - deltaZ / 50.0;
		mat4.translate(transform, transform, tm0);
		mat4.scale(transform, transform, [zoom, 1.0, 1.0]);
		mat4.translate(transform, transform, tm0n);
		restrictTransform(transform);
		mat4.invert(invtransform, transform);
		requestAnimFrame(render);
		repositionHistogramLabels();
		
		// Trigger mouse move event, because the relative mouse position might have changed
		this.onMouseMove(canvas, clientX, clientY, pressedmousebuttons);
	}
	
	function restrictTransform(transform)
	{
		// Restrict transformations to keep the whole canvas (-1 ... 1) filled with (part of) the color map
		
		if(transform[0] < 1.0) // If zoomed out more than zoom == 1.0
			transform[0] = 1.0;
		if(-1.0 * transform[0] + transform[12] > -1.0) // If out of bounds left
			transform[12] = 1.0 * transform[0] - 1.0;
		else if(1.0 * transform[0] + transform[12] < 1.0) // If out of bounds right
			transform[12] = 1.0 - 1.0 * transform[0];
	}
	
	function InsertSplitterPin(xr)
	{
		// Find section containing xr
		var sectionIdx;
		for(sectionIdx = 0; sectionIdx < sections.length; ++sectionIdx)
			if(sections[sectionIdx].start.pos < xr && xr <= sections[sectionIdx].end.pos)
				break;
		if(sectionIdx == sections.length)
			return;
		
		// Insert splitter at xr
		var newSplitter = {
			fixed: false,
			pos: xr,
			left: null,
			right: null
		};
		splitters.push(newSplitter);
		var newSection = {
			colorMap: sections[sectionIdx].colorMap,
			start: sections[sectionIdx].start,
			end: newSplitter,
			startValue: sections[sectionIdx].startValue,
			endValue: sections[sectionIdx].endValue,
			flipped: sections[sectionIdx].flipped,
			startAlpha: 1.0,
			endAlpha: 1.0
		};
		sections[sectionIdx].start.right = newSection;
		sections[sectionIdx].start = newSplitter;
		newSplitter.left = newSection;
		newSplitter.right = sections[sectionIdx];
		sections.splice(sectionIdx, 0, newSection);
		
		requestAnimFrame(render);
		onColorTableChanged(sections);
		updateDragPointDisplay();
		
		return {splitter: newSplitter, removeRight: false};
	}
	function InsertNestedPin(xr)
	{
		// Find section containing xr
		var sectionIdx;
		for(sectionIdx = 0; sectionIdx < sections.length; ++sectionIdx)
			if(sections[sectionIdx].start.pos < xr && xr <= sections[sectionIdx].end.pos)
				break;
		if(sectionIdx == sections.length)
			return;
		
		var delta = 10.0 / canvas.width * invtransform[0];
		
		// Insert interjector at xr
		var leftSplitter = {
			fixed: false,
			pos: Math.max(xr - delta, sections[sectionIdx].start.pos + 1e-5),
			left: null,
			right: null
		};
		var rightSplitter = {
			fixed: false,
			pos: Math.min(xr + delta, sections[sectionIdx].end.pos - 1e-5),
			left: null,
			right: null
		};
		splitters.push(leftSplitter, rightSplitter);
		var newSection = {
			colorMap: sections[sectionIdx].colorMap,
			start: leftSplitter,
			end: rightSplitter,
			startValue: sections[sectionIdx].startValue,
			endValue: sections[sectionIdx].endValue,
			flipped: sections[sectionIdx].flipped,
			startAlpha: 1.0,
			endAlpha: 1.0
		};
		sections.splice(sectionIdx, 0, newSection);
		
		leftSplitter.right = rightSplitter.left = newSection;
		
		requestAnimFrame(render);
		onColorTableChanged(sections);
		updateDragPointDisplay();
		
		return {splitter: leftSplitter, removeRight: false}; // Removing one splitter of a nested section automatically removes all other splitters of it
	}
	
	function RemoveSplitter(params)
	{
		var splitter = params.splitter;
		
		if(splitter === null || splitter.fixed === true)
			return;
		var splitterIdx = splitters.indexOf(splitter);
		if(splitterIdx == -1)
			return;
		
		var removedSplitters = [], removedSections = [];
		var removeSplitter = function(idx) {
			removedSplitters.push([idx, splitters[idx]]);
			splitters.splice(idx, 1);
		};
		var removeSection = function(idx) {
			removedSections.push([idx, sections[idx]]);
			sections.splice(idx, 1);
		};
		
		// Remove dragSplitter
		removeSplitter(splitterIdx);
		
		if(splitter.left === null)
		{
			// Iteratively remove section splitter.right and splitter splitter.right.end
			while(splitter.right !== null)
			{
				removeSection(sections.indexOf(splitter.right));
				removeSplitter(splitters.indexOf(splitter.right.end));
				
				splitter = splitter.right.end;
			}
		}
		else if(splitter.right === null)
		{
			// Iteratively remove section splitter.left and splitter splitter.left.start
			while(splitter.left !== null)
			{
				removeSection(sections.indexOf(splitter.left));
				removeSplitter(splitters.indexOf(splitter.left.start));
				
				splitter = splitter.left.start;
			}
		}
		else
		{
			if(params.removeRight === true)
			{
				// Remove section splitter.right and connect splitter splitter.right.end to section splitter.left
				splitter.right.end.left = splitter.left;
				splitter.left.end = splitter.right.end;
				removeSection(sections.indexOf(splitter.right));
			}
			else
			{
				// Remove section splitter.left and connect splitter splitter.left.start to section splitter.right
				splitter.left.start.right = splitter.right;
				splitter.right.start = splitter.left.start;
				removeSection(sections.indexOf(splitter.left));
			}
		}
		
		requestAnimFrame(render);
		onColorTableChanged(sections);
		updateDragPointDisplay();
		
		return {splitter, removedSplitters, removedSections};
	}
	function UndoRemoveSplitter(params)
	{
		// Recreate sections and splitters in reverse order
		for(var i = params.removedSplitters.length - 1; i >= 0; --i)
			splitters.splice(params.removedSplitters[i][0], 0, params.removedSplitters[i][1]);
		for(var i = params.removedSections.length - 1; i >= 0; --i)
			sections.splice(params.removedSections[i][0], 0, params.removedSections[i][1]);
		
		if(params.splitter.left !== null && params.splitter.right !== null)
		{
			// Reconnect splitter splitter.left.start and section splitter.right to splitter
			params.splitter.left.start.right = params.splitter.left;
			params.splitter.right.start = params.splitter;
		}
		
		requestAnimFrame(render);
		onColorTableChanged(sections);
		updateDragPointDisplay();
		
		return {splitter: params.splitter, removeRight: false};
	}
	
	function MoveSplitter(params)
	{
		var splitter = params.splitter;
		var oldpos = splitter.pos;
		splitter.pos = params.pos;
		
		requestAnimFrame(render);
		onColorTableChanged(sections);
		updateDragPointDisplay();
		
		return {splitter: splitter, pos: oldpos};
	}
	
	function MoveAlpha(params)
	{
		if (params.splitter != null) // ALPHA_MODE == 'SPLITTER'
		{
			var splitter = params.splitter;
			var oldAlpha = 0.0;
			if(splitter.left != null)
			{
				oldAlpha = splitter.left.endAlpha;
				splitter.left.endAlpha = params.alpha;
			}
			if(splitter.right != null)
			{
				oldAlpha = splitter.right.startAlpha;
				splitter.right.startAlpha = params.alpha;
			}
			
			requestAnimFrame(render);
			onColorTableChanged(sections);
			updateDragPointDisplay();
			
			return {splitter: splitter, alpha: oldAlpha};
		}
		else if (params.section != null) // ALPHA_MODE == 'SECTION'
		{
			var section = params.section;
			var oldStartAlpha = section.startAlpha, oldEndAlpha = section.endAlpha;
			section.startAlpha = params.startAlpha;
			section.endAlpha = params.endAlpha;
			
			requestAnimFrame(render);
			onColorTableChanged(sections);
			updateDragPointDisplay();
			
			return {section: section, startAlpha: oldStartAlpha, endAlpha: oldEndAlpha};
		}
	}
	
	function CropSection(params)
	{
		var section = params.section;
		var oldStartValue = section.startValue, oldEndValue = section.endValue;
		section.startValue = params.startValue;
		section.endValue = params.endValue;
		
		requestAnimFrame(render);
		onColorTableChanged(sections);
		
		return {section: section, startValue: oldStartValue, endValue: oldEndValue};
	}
	
	function SetSectionColormap(params)
	{
		var sectionIdx = params.sectionIdx;
		if(sectionIdx < 0 || sectionIdx >= sections.length)
			return;
		var section = sections[sectionIdx];
		var colormap = params.colormap;
		var flipped = params.flipped;
		/*var oldcolormap = section.colorMap;
		var oldflipped = section.flipped;*/
		
		var newsections = [], newsplitters = [];
		if(colormap.sections)
		{
			//EDIT: handle flipped colormaps with nested sections
			
			/*console.log("");
			console.log("OLD:");
			for(var k = 0; k < splitters.length; ++k)
				console.log(splitters[k]);
			for(var k = 0; k < sections.length; ++k)
				console.log(sections[k]);*/
			
			var bounds_left = section.start.pos;
			var bounds_right = section.end.pos;
			colormap.splitters.forEach(function(cmSplitter) {
				if(!cmSplitter.fixed)
					// Clone cmSplitter into splitters
					newsplitters.push({
						fixed: cmSplitter.fixed,
						pos: bounds_left + cmSplitter.pos * (bounds_right - bounds_left), // Rescale pos from [0, 1] to section range
						left: cmSplitter.left === null ? null : colormap.sections.indexOf(cmSplitter.left), // Temporarily store index instead of pointer
						right: cmSplitter.right === null ? null : colormap.sections.indexOf(cmSplitter.right) // Temporarily store index instead of pointer
					});
			});
			
			colormap.sections.forEach(function(cmSection) {
				// Clone cmSection into sections
				var newsection;
				newsections.push(newsection = {
					colorMap: cmSection.colorMap,
					startValue: cmSection.startValue,
					endValue: cmSection.endValue,
					flipped: cmSection.flipped,
					startAlpha: cmSection.startAlpha,
					endAlpha: cmSection.endAlpha
				});
				
				if(cmSection.start.fixed)
				{
					// Link to section.start, instead of 0.0-splitter of colormap
					newsection.start = section.start;
					section.start.right = newsection;
				}
				else
					newsection.start = newsplitters[colormap.splitters.indexOf(cmSection.start) - 2]; // -2 ... fixed splitters aren't stored in newsplitters
				
				if(cmSection.end.fixed)
				{
					// Link to section.end, instead of 1.0-splitter of colormap
					newsection.end = section.end;
					section.end.left = newsection;
				}
				else
					newsection.end = newsplitters[colormap.splitters.indexOf(cmSection.end) - 2]; // -2 ... fixed splitters aren't stored in newsplitters
			});
			
			// Replace temporary indices with pointers
			newsplitters.forEach(function(newsplitter) {
				//console.log(newsplitter.left);
				//console.log(newsections[newsplitter.left]);
				if(newsplitter.left !== null)
					newsplitter.left = newsections[newsplitter.left];
				if(newsplitter.right !== null)
					newsplitter.right = newsections[newsplitter.right];
			});
			
			/*// Store new sections and splitters
			sections = sections.slice(0, sectionIdx).concat(newsections).concat(sections.slice(sectionIdx + 1)); // Replace section with newsections inside sections
			splitters = splitters.concat(newsplitters); // Concat newsplitters to splitters*/
			
			/*console.log("NEW:");;
			for(var k = 0; k < splitters.length; ++k)
				console.log(splitters[k]);
			for(var k = 0; k < sections.length; ++k)
				console.log(sections[k]);*/
		}
		else
		{
			/*section.colorMap = colormap;
			section.flipped = flipped;
			section.startValue = 0.0;
			section.endValue = 1.0;*/
			
			var newsection;
			newsections.push(newsection = {
				colorMap: colormap,
				startValue: 0.0,
				endValue: 1.0,
				flipped: flipped,
				start: section.start,
				end: section.end,
				startAlpha: section.startAlpha,
				endAlpha: section.endAlpha
			});
			if(newsection.start !== null)
				newsection.start.right = newsection;
			if(newsection.end !== null)
				newsection.end.left = newsection;
		}
		
		// Store new sections and splitters
		sections = sections.slice(0, sectionIdx).concat(newsections).concat(sections.slice(sectionIdx + 1)); // Replace section with newsections inside sections
		splitters = splitters.concat(newsplitters); // Concat newsplitters to splitters
		
		requestAnimFrame(render);
		onColorTableChanged(sections);
		updateDragPointDisplay();
		
		//return {sectionIdx: sectionIdx, colormap: oldcolormap, flipped: oldflipped};
		return {
			oldsections: newsections,
			newsections: [section],
			oldsplitters: newsplitters,
			newsplitters: []
		};
	}
	function ReplaceSectionsAndSplitters(params)
	{
		// >>> Replace params.oldsections with params.newsections (sections have to be sequential!)
		
		// Old method:
		// Doesn't work when first section != leftmost section (happens with interlinkt colormaps containing interjector pins)
		//var firstOld = params.oldsections[0], lastOld = params.oldsections[params.oldsections.length - 1];
		//var firstNew = params.newsections[0], lastNew = params.newsections[params.newsections.length - 1];
		//var firstOldIdx = sections.indexOf(firstOld), lastOldIdx = sections.indexOf(lastOld);
		
		// New method:
		// Fixes a bug when first section != leftmost section (happens with interlinkt colormaps containing interjector pins)
		var findFirst = function(sections) { // Search for section with leftmost start pin
			return sections.reduce(function(acc, cur) {
				return cur.start == null || (acc.start != null && acc.start.pos < cur.start.pos) ? acc : cur;
			}, sections[0]);
		};
		var findLast = function(sections) { // Search for section with rightmost end pin
			return sections.reduceRight(function(acc, cur) {
				return cur.end == null || (acc.end != null && acc.end.pos > cur.end.pos) ? acc : cur;
			}, sections[sections.length - 1]);
		};
		var firstOld = findFirst(params.oldsections), lastOld = findLast(params.oldsections); // Find leftmost/rightmost sections of params.oldsections
		var firstNew = findFirst(params.newsections), lastNew = findLast(params.newsections); // Find leftmost/rightmost sections of params.newsections
		var firstOldIdx = sections.indexOf(params.oldsections[0]), lastOldIdx = sections.indexOf(params.oldsections[params.oldsections.length - 1]); // Indices of first/last (not leftmost/rightmost) sections
		
		// Link new sections in place of old sections
		if(firstOld.start != null)
			firstOld.start.right = firstNew;
		firstNew.start = firstOld.start;
		if(lastOld.end != null)
			lastOld.end.left = lastNew;
		lastNew.end = lastOld.end;
		
		// Replace old sections with new sections in sections
		var newsections = firstOldIdx > 0 ? sections.slice(0, firstOldIdx) : [];
		newsections = newsections.concat(params.newsections);
		if(lastOldIdx + 1 < sections.length)
			newsections = newsections.concat(sections.slice(lastOldIdx + 1));
		sections = newsections;
		
		// >>> Replace params.oldsplitters with params.newsplitters (splitters have to be sequential!)
		
		var firstOld = params.oldsplitters[0], lastOld = params.oldsplitters[params.oldsplitters.length - 1];
		var firstNew = params.newsplitters[0], lastNew = params.newsplitters[params.newsplitters.length - 1];
		var firstOldIdx = splitters.indexOf(firstOld), lastOldIdx = splitters.indexOf(lastOld);
		
		// Replace old splitters with new splitters in splitters
		if(firstOldIdx === -1 || lastOldIdx === -1)
			splitters = splitters.concat(params.newsplitters);
		else
		{
			var newsplitters = firstOldIdx > 0 ? splitters.slice(0, firstOldIdx) : [];
			newsplitters = newsplitters.concat(params.newsplitters);
			if(lastOldIdx + 1 < splitters.length)
				newsplitters = newsplitters.concat(splitters.slice(lastOldIdx + 1));
			splitters = newsplitters;
		}
		
		requestAnimFrame(render);
		onColorTableChanged(sections);
		updateDragPointDisplay();
		
		return {
			oldsections: params.newsections,
			newsections: params.oldsections,
			oldsplitters: params.newsplitters,
			newsplitters: params.oldsplitters
		};
	}
	
	function LoadColormap(colormap)
	{
		var oldsplitters = splitters;
		var oldsections = sections;
		
		if(colormap.sections) // If the loaded colormap contains sections and splitters
		{
			splitters = colormap.splitters;
			sections = colormap.sections;
		}
		else
		{
			// Reset sections and splitters
			splitters = splitters.slice(0, 2);
			sections = [];
			
			// Add colormap to sections
			sections.push({
				colorMap: colormap,
				start: splitters[0],
				end: splitters[1],
				startValue: 0.0,
				endValue: 1.0,
				flipped: false,
				startAlpha: 1.0,
				endAlpha: 1.0
			});
			splitters[0].right = splitters[1].left = colormap;
		}
		
		colormap.inPicker = false; // Do not add colormap to colormap picker
		onColorMapsLoaded([colormap]);
		
		requestAnimFrame(render);
		onColorTableChanged(sections);
		updateDragPointDisplay();
		
		return {colormap, oldsplitters, oldsections};
	}
	function UndoLoadColormap(params)
	{
		splitters = params.oldsplitters;
		sections = params.oldsections;
		
		onColorMapsUnloaded([params.colormap]);
		
		requestAnimFrame(render);
		onColorTableChanged(sections);
		updateDragPointDisplay();
	}
	
	this.serializeColorMap = function(serializer)
	{
		// Custom string endsWith() function:
		if(String.prototype.endsWith == null)
			String.prototype.endsWith = function(s) {
				return this.substring(this.length - s.length, this.length) == s;
			}
		
		var GetTopLevelSection = function(x) {
			var toplevel_section = null;
			sections.forEach(function(section) {
				if(toplevel_section === null && section.start.pos <= x && x <= section.end.pos)
					toplevel_section = section;
			});
			return toplevel_section;
		};
		var DrawIfTopLevel = function(section, x, rgb, alpha) {
			var toplevel_section = GetTopLevelSection(x);
			if(toplevel_section === section) // If the current section isn't overlapped by another section:
			{
				cmControlPoints[x] = [x, rgb[0] / 255.0, rgb[1] / 255.0, rgb[2] / 255.0, alpha];
				cmControlPointKeys.push(x);
				return null;
			}
			else
				return toplevel_section;
		};
		
		// name is names of sub-color-maps separated by " / "
		var name = "";
		sections.forEach(function(section) {
			name += section.colorMap.name + " / ";
		});
		if(name.endsWith(" / "))
			name = name.substring(0, name.length - 3);
		
		serializer.colormapStart("Interlinked", name);
		
		// Add control points
		var cmControlPoints = [], cmControlPointKeys = [];
		var offset, delta, valueOffset, valueDelta;
		sections.forEach(function(section) {
			
			// If this colormap overlaps another colormap, add a control point just left of section.start
			var prevSection;
			if (section.start.left === null && section.start.pos - 1e-5 > 0.0 && (prevSection = GetTopLevelSection(section.start.pos - 1e-5)) !== null)
			{
				var x = (section.start.pos - 1e-5 - prevSection.start.pos) / (prevSection.end.pos - prevSection.start.pos);
				//console.log(x);
				
				//TODO: The following code seems to work, but it should be generalized. Lot's of double code here!
				
				// Find offset & delta to convert control point location to relative location
				if(prevSection.flipped === true)
				{
					offset = prevSection.end.pos;
					delta = prevSection.start.pos - prevSection.end.pos;
					if(prevSection.start.left !== null)
						delta += 1e-5;
				}
				else
				{
					offset = prevSection.start.pos;
					delta = prevSection.end.pos - prevSection.start.pos;
					if(prevSection.start.left !== null)
					{
						offset += 1e-5;
						delta -= 1e-5;
					}
				}
				
				// Compute scale for values
				if(prevSection.flipped === true)
				{
					valueOffset = prevSection.endValue - 1.0;
					valueDelta = -1.0 / (prevSection.startValue - prevSection.endValue);
				}
				else
				{
					valueOffset = -prevSection.startValue;
					valueDelta = 1.0 / (prevSection.endValue - prevSection.startValue);
				}
				
				DrawIfTopLevel(
					prevSection,
					offset + x * delta,
					prevSection.colorMap.interpolatedColorMap.sample((x + valueOffset) * valueDelta),
					section.flipped ?
						(1.0 - x) * prevSection.endAlpha + x * prevSection.startAlpha :
						x * prevSection.endAlpha + (1.0 - x) * prevSection.startAlpha
				);
			}
			
			// If this colormap overlaps another colormap, add a control point just right of section.end
			var nextSection;
			if (section.end.right === null && section.end.pos + 1e-5 < 1.0 && (nextSection = GetTopLevelSection(section.end.pos + 1e-5)) !== null)
			{
				var x = (section.end.pos + 1e-5 - nextSection.start.pos) / (nextSection.end.pos - nextSection.start.pos);
				//console.log(x);
				
				//TODO: The following code seems to work, but it should be generalized. Lot's of double code here!
				
				// Find offset & delta to convert control point location to relative location
				if(nextSection.flipped === true)
				{
					offset = nextSection.end.pos;
					delta = nextSection.start.pos - nextSection.end.pos;
					if(nextSection.start.left !== null)
						delta += 1e-5;
				}
				else
				{
					offset = nextSection.start.pos;
					delta = nextSection.end.pos - nextSection.start.pos;
					if(nextSection.start.left !== null)
					{
						offset += 1e-5;
						delta -= 1e-5;
					}
				}
				
				// Compute scale for values
				if(nextSection.flipped === true)
				{
					valueOffset = nextSection.endValue - 1.0;
					valueDelta = -1.0 / (nextSection.startValue - nextSection.endValue);
				}
				else
				{
					valueOffset = -nextSection.startValue;
					valueDelta = 1.0 / (nextSection.endValue - nextSection.startValue);
				}
				
				DrawIfTopLevel(
					nextSection,
					offset + x * delta,
					nextSection.colorMap.interpolatedColorMap.sample((x + valueOffset) * valueDelta),
					section.flipped ?
						(1.0 - x) * nextSection.endAlpha + x * nextSection.startAlpha :
						x * nextSection.endAlpha + (1.0 - x) * nextSection.startAlpha
				);
			}
			
			// Find offset & delta to convert control point location to relative location
			if(section.flipped === true)
			{
				offset = section.end.pos;
				delta = section.start.pos - section.end.pos;
				if(section.start.left !== null)
					delta += 1e-5;
			}
			else
			{
				offset = section.start.pos;
				delta = section.end.pos - section.start.pos;
				if(section.start.left !== null)
				{
					offset += 1e-5;
					delta -= 1e-5;
				}
			}
			if(section.colorMap.interpolatedColorMap != null)
			{
				var controlPointKeys = section.colorMap.interpolatedColorMap.getKeys();
				var controlPoints = section.colorMap.interpolatedColorMap.getSamples();
				
				if(section.startValue == 0.0 && section.endValue == 1.0) // If section isn't cropped
					// Simply add control points rescaled from [0; 1] to [section.start.pos; section.end.pos] or [section.end.pos; section.start.pos] (if flipped)
					controlPointKeys.forEach(function(controlPointKey) {
						var controlPoint = controlPoints[controlPointKey];
						var x = offset + controlPointKey * delta;
						if(section.flipped)
							controlPointKey = 1.0 - controlPointKey;
						var alpha = controlPointKey * section.endAlpha + (1.0 - controlPointKey) * section.startAlpha;
						
						DrawIfTopLevel(section, x, controlPoint, alpha);
					});
				else // If section is cropped
				{
					// Compute scale for values
					if(section.flipped === true)
					{
						valueOffset = section.endValue - 1.0;
						valueDelta = -1.0 / (section.startValue - section.endValue);
					}
					else
					{
						valueOffset = -section.startValue;
						valueDelta = 1.0 / (section.endValue - section.startValue);
					}
					
					// Add boundary control points
					if(section.startValue > 0.0)
						DrawIfTopLevel(
							section,
							offset + 0.0 * delta,
							section.colorMap.interpolatedColorMap.sample((0.0 + valueOffset) * valueDelta),
							section.flipped ? section.endAlpha : section.startAlpha
						); //EDIT: Untested
					else if(section.startValue < 0.0)
						DrawIfTopLevel(
							section,
							offset + 0.0 * delta,
							section.colorMap.interpolatedColorMap.sample((0.0 + valueOffset) * valueDelta),
							section.flipped ? section.endAlpha : section.startAlpha
						); //EDIT: Untested
					if(section.endValue < 1.0)
						DrawIfTopLevel(
							section,
							offset + 1.0 * delta,
							section.colorMap.interpolatedColorMap.sample((1.0 + valueOffset) * valueDelta),
							section.flipped ? section.startAlpha : section.endAlpha
						); //EDIT: Untested
					else if(section.endValue > 1.0)
						DrawIfTopLevel(
							section,
							offset + 1.0 * delta,
							section.colorMap.interpolatedColorMap.sample((1.0 + valueOffset) * valueDelta),
							section.flipped ? section.startAlpha : section.endAlpha
						); //EDIT: Untested
					
					// Add control points in the range [0.0 < value_rescaled < 1.0]
					controlPointKeys.forEach(function(controlPointKey) {
						var value = (controlPointKey + valueOffset) * valueDelta;
						if(value > 0.0 && value < 1.0)
						{
							var controlPoint = section.colorMap.interpolatedColorMap.sample(value);
							var x = offset + controlPointKey * delta;
							if(section.flipped)
								controlPointKey = 1.0 - controlPointKey;
							var alpha = controlPointKey * section.endAlpha + (1.0 - controlPointKey) * section.startAlpha;
							
							DrawIfTopLevel(section, x, controlPoint, alpha);
						}
					});
				}
			}
			else
			{
				// section.colorMap == solid color
				var rgb = [section.colorMap.bytes[0], section.colorMap.bytes[1], section.colorMap.bytes[2]];
				
				DrawIfTopLevel(section, offset, rgb, section.startAlpha);
				DrawIfTopLevel(section, offset + delta, rgb, section.endAlpha);
			}
		});
		
		cmControlPointKeys.sort(function(a,b) {return a - b;});
		cmControlPointKeys.forEach(function(controlPointKey) {
			var p = cmControlPoints[controlPointKey];
			serializer.point(p[0], p[1], p[2], p[3], p[4]);
		});
		
		// Add colorscale metadata
		sections.forEach(function(section) {
			var startSplitterIdx = splitters.indexOf(section.start), endSplitterIdx = splitters.indexOf(section.end);
			serializer.section(section, startSplitterIdx, endSplitterIdx);
		});
		
		serializer.colormapEnd();
		return serializer.serialize();
	}

	this.highlightValue = function(value, location)
	{
		if (value === null || value < 0.0 || value >= 1.0)
			highlightLine.style.display = "none";
		else
		{
			highlightLine.style.display = "inline-block";
			highlightLine.style.left = location;
			if (ENABLE_HIGHLIGHT_LABEL)
				highlightLineLabel.innerText = value.toPrecision(6);
		}
	}











	// >>> Region: Touch support //EDIT: Make generic and move to Input.js
	this.onTouchStart = function(event)
	{
var canvas = event.target;
		if(event.touches.length == 1)
		{
var idx = mouseHandlerCanvasList.indexOf(event.target);
var mouseHandler = mouseHandlers[idx];

			var touch = event.touches[0];
			var canvas_bounds = canvas.getBoundingClientRect();

			event.preventDefault();
			// Fire mouse move once before to correctly handle mouse-down events that depend on a previouse mouse-move
			mouseHandler.onMouseMove(canvas, touch.pageX - canvas_bounds.left, touch.pageY - canvas_bounds.top, [false, true, false]);
			mouseHandler.onMouseDown(canvas, touch.pageX - canvas_bounds.left, touch.pageY - canvas_bounds.top, 1);
		}
	}
	this.onTouchMove = function(event)
	{
var canvas = event.target;

		if(event.touches.length == 1)
		{
var idx = mouseHandlerCanvasList.indexOf(event.target);
var mouseHandler = mouseHandlers[idx];
			
			var touch = event.touches[0];
			var canvas_bounds = canvas.getBoundingClientRect();
			
			event.preventDefault();
			mouseHandler.onMouseMove(canvas, touch.pageX - canvas_bounds.left, touch.pageY - canvas_bounds.top, null);
		}
	}
	this.onTouchEnd = function(event)
	{
var canvas = event.target;

		if(event.changedTouches.length == 1)
		{
var idx = mouseHandlerCanvasList.indexOf(event.target);
var mouseHandler = mouseHandlers[idx];

			var touch = event.changedTouches[0];
			var target = document.elementFromPoint(touch.clientX, touch.clientY);
			var canvas_bounds = canvas.getBoundingClientRect();
			
			event.preventDefault();
			mouseHandler.onMouseUp(canvas, touch.pageX - canvas_bounds.left, touch.pageY - canvas_bounds.top, 1, target);
		}
	}
	// <<< End region: Touch support
}