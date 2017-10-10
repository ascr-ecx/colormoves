readColorMapsFromXml = function(filename, colorMapSize, onloaded)
{
	var xmlhttp = window.XMLHttpRequest ? new XMLHttpRequest() : new ActiveXObject("Microsoft.XMLHTTP");
	xmlhttp.open("GET", filename, true);
	xmlhttp.onload = function() {
		xmlDoc = xmlhttp.responseXML;
		if(xmlDoc == null)
		{
			alert("Error reading XML file");
			return;
		}
		
		/*ar colormaps = xmlDoc.getElementsByTagName("ColorMaps");
		console.log(colormaps[0]);
		console.log(colormaps[0].children);*/
		
		var colorMaps = [];
		var colorMapElements = xmlDoc.getElementsByTagName('ColorMap');
		for(var i = 0; i < colorMapElements.length; ++i)
		{
			var colorMapElement = colorMapElements[i];
			
			var colorMapName = colorMapElement.getAttribute('name');
			if(colorMapName == null)
				colorMapName = "Color map " + (i + 1);
			
			var colorMapGroup = colorMapElement.getAttribute('group');
			if(colorMapGroup == null)
				colorMapGroup = "";
			
			var colorTable = new InterpolatedColorMap();
			var nanColor = [0.0, 0.0, 0.0];
			
			//console.log(colorMapElements[i].getElementsByTagName('Point').length);
			//console.log(colorMapElements[i]);
			
			var colorMapPoints = colorMapElement.getElementsByTagName('Point');
			for(var j = 0; j < colorMapPoints.length; ++j)
			{
				var colorMapPoint = colorMapPoints[j];
				
				var x = colorMapPoint.getAttribute('x');
				var r = colorMapPoint.getAttribute('r');
				var g = colorMapPoint.getAttribute('g');
				var b = colorMapPoint.getAttribute('b');
				var a = colorMapPoint.getAttribute('o');
				if(a === null)
					a = 1.0;
				if(x !== null && r !== null && g !== null && b !== null &&
					r >= 0.0 && r <= 1.0 && g >= 0.0 && g <= 1.0 && b >= 0.0 && b <= 1.0)
					colorTable.AddColor(x, r * 255.0, g * 255.0, b * 255.0, a * 255.0);
			}
			
			var colorMapNaNs = colorMapElement.getElementsByTagName('NaN');
			if(colorMapNaNs.length > 0)
			{
				var colorMapNaN = colorMapNaNs[0];
				
				var r = colorMapPoint.getAttribute('r');
				var g = colorMapPoint.getAttribute('g');
				var b = colorMapPoint.getAttribute('b');
				if(r !== null && g !== null && b !== null &&
					r >= 0.0 && r <= 1.0 && g >= 0.0 && g <= 1.0 && b >= 0.0 && b <= 1.0)
					nanColor = [r, g, b];
			}
			
			var colorMapSectionElements = colorMapElement.getElementsByTagName('Section');
			var colorMapSections = [];
			var colorMapSplitters = [
				{fixed: true, pos: 0.0, left: null, right: null},
				{fixed: true, pos: 1.0, left: null, right: null}
			];
			for(var j = 0; j < colorMapSectionElements.length; ++j)
			{
				var colorMapSectionElement = colorMapSectionElements[j];
				
				var colorMapName2 = colorMapSectionElement.getAttribute('colorMapName');
				var startIndex = colorMapSectionElement.getAttribute('startIndex');
				var endIndex = colorMapSectionElement.getAttribute('endIndex');
				var startPos = colorMapSectionElement.getAttribute('startPos');
				var endPos = colorMapSectionElement.getAttribute('endPos');
				var startValue = colorMapSectionElement.getAttribute('startValue');
				if(startValue === null) startValue = 0.0;
				var endValue = colorMapSectionElement.getAttribute('endValue');
				if(endValue === null) endValue = 1.0;
				var flipped = colorMapSectionElement.getAttribute('flipped');
				if(flipped === null) flipped = false;
				var startAlpha = colorMapSectionElement.getAttribute('startAlpha');
				if(startAlpha === null) startAlpha = 1.0;
				var endAlpha = colorMapSectionElement.getAttribute('endAlpha');
				if(endAlpha === null) endAlpha = 1.0;
				if(colorMapName2 !== null && startIndex !== null && endIndex !== null && startPos !== null && endPos !== null)
				{
					// Resize colorMapSplitters to include both startIndex && endIndex
					for(var k = colorMapSplitters.length; k <= startIndex; ++k)
						colorMapSplitters.push({});
					for(var k = colorMapSplitters.length; k <= endIndex; ++k)
						colorMapSplitters.push({});
					
					// Add section
					var section = {
						colorMap: colorMapName2,
						start: colorMapSplitters[parseInt(startIndex)],
						end: colorMapSplitters[parseInt(endIndex)],
						startValue: parseFloat(startValue),
						endValue: parseFloat(endValue),
						flipped: (flipped === 'true'),
						startAlpha: startAlpha,
						endAlpha: endAlpha
					};
					colorMapSections.push(section);
					
					// Define start splitter
					if(!('fixed' in colorMapSplitters[startIndex])) // If colorMapSplitters[startIndex] is not yet defined
					{
						colorMapSplitters[startIndex].fixed = false;
						colorMapSplitters[startIndex].pos = parseFloat(startPos);
						colorMapSplitters[startIndex].left = null;
						colorMapSplitters[startIndex].right = section;
					}
					else
						colorMapSplitters[startIndex].right = section;
					
					// Define end splitter
					if(!('fixed' in colorMapSplitters[endIndex])) // If colorMapSplitters[endIndex] is not yet defined
					{
						colorMapSplitters[endIndex].fixed = false;
						colorMapSplitters[endIndex].pos = parseFloat(endPos);
						colorMapSplitters[endIndex].left = section;
						colorMapSplitters[endIndex].right = null;
					}
					else
						colorMapSplitters[endIndex].left = section;
				}
			}
			
			colorMaps[colorMapName] = {
				name: colorMapName,
				group: colorMapGroup,
				nanclr: nanColor,
				bytes: colorTable.Create(colorMapSize),
				flipped: 0,
				inPicker: true,
				interpolatedColorMap: colorTable,
				//controlPoints: colorTable.getSamples(),
				//controlPointKeys: colorTable.getKeys(),
				sections: colorMapSections.length <= 1 ? null : colorMapSections,
				splitters: colorMapSplitters.length <= 2 ? null : colorMapSplitters
			};
			
			var colorMapDefault = colorMapElement.getAttribute('default');
			if(colorMaps._default == null && colorMapDefault === "true")
				colorMaps._default = colorMaps[colorMapName];
		}
		
		if(colorMaps._default == null)
			for(var key in colorMaps)
			{
				colorMaps._default = colorMaps[key];
				break;
			}
		
		onloaded(colorMaps);
	};
	xmlhttp.send();
}

function ColormapXmlSerializer()
{
	this.header = function()
	{
		return '<ColorMaps>\n';
	}
	
	this.colormapStart = function(group, name)
	{
		return '<ColorMap space="Lab" indexedLookup="false" group="' + group + '" name="' + name + '">\n';
	}
	
	this.point = function(x, r, g, b, a)
	{
		return '<Point x="' + x + '" o="' + a + '" r="' + r + '" g="' + g + '" b="' + b + '"/>\n';
	}
	
	this.section = function(section, startIndex, endIndex)
	{
		return '<Section colorMapName="' + section.colorMap.name +
			'" startIndex="' + startIndex + '" endIndex="' + endIndex +
			'" startPos="' + section.start.pos + '" endPos="' + section.end.pos +
			'" startValue="' + section.startValue + '" endValue="' + section.endValue +
			'" flipped="' + (section.flipped ? 'true' : 'false') +
			'" startAlpha="' + section.startAlpha + '" endAlpha="' + section.endAlpha +
			'"/>\n'
		;
	}
	
	this.colormapEnd = function()
	{
		return '</ColorMap>\n';
	}
	
	this.footer = function()
	{
		return '</ColorMaps>\n';
	}
}

function ColormapXmlSerializer()
{
	// Write header
	var cm = '<ColorMaps>\n';
	
	this.colormapStart = function(group, name)
	{
		cm += '\t<ColorMap space="Lab" indexedLookup="false" group="' + group + '" name="' + name + '">\n';
	}
	
	this.point = function(x, r, g, b, a)
	{
		cm += '\t\t<Point x="' + x + '" o="' + a + '" r="' + r + '" g="' + g + '" b="' + b + '"/>\n';
	}
	
	this.section = function(section, startIndex, endIndex)
	{
		cm += '\t\t<Section colorMapName="' + section.colorMap.name +
			'" startIndex="' + startIndex + '" endIndex="' + endIndex +
			'" startPos="' + section.start.pos + '" endPos="' + section.end.pos +
			'" startValue="' + section.startValue + '" endValue="' + section.endValue +
			'" flipped="' + (section.flipped ? 'true' : 'false') +
			'" startAlpha="' + section.startAlpha + '" endAlpha="' + section.endAlpha +
			'"/>\n'
		;
	}
	
	this.colormapEnd = function()
	{
		cm += '\t</ColorMap>\n';
	}
	
	this.serialize = function()
	{
		// Write footer
		cm += '</ColorMaps>\n';
		return cm;
	}
}

function ColormapJsonSerializer()
{
	var colormaps = [];
	var currentColormap = null;
	
	this.colormapStart = function(group, name)
	{
		currentColormap = {space: "Lab", indexedLookup: false, group: group, name: name, points: [], sections: []};
	}
	
	this.point = function(x, r, g, b, a)
	{
		currentColormap.points.push({x: x, o: a, r: r, g: g, b: b});
	}
	
	this.section = function(section, startIndex, endIndex)
	{
		currentColormap.sections.push({
			colorMapName: section.colorMap.name,
			startIndex: startIndex,
			endIndex: endIndex,
			startPos: section.start.pos,
			endPos: section.end.pos,
			startValue: section.startValue,
			endValue: section.endValue,
			flipped: section.flipped ? true : false,
			startAlpha: section.startAlpha,
			endAlpha: section.endAlpha
		});
	}
	
	this.colormapEnd = function()
	{
		colormaps.push(currentColormap);
		currentColormap = null;
	}
	
	this.serialize = function()
	{
		return JSON.stringify({colormaps: colormaps});
	}
}

function ColormapPngSerializer(size)
{
	var points = [];
	var colormapBytes = new Uint8Array(4 * size);
	for (var i = 0; i < 4 * size; ++i)
		colormapBytes[i] = 0;
	
	this.colormapStart = function(group, name) { }
	
	this.point = function(x, r, g, b, a)
	{
		points.push({x: x, o: a, r: r, g: g, b: b});
	}
	
	this.section = function(section, startIndex, endIndex)
	{
		var interpolatedColormap = new InterpolatedColorMap();
		for (var i = points.length - 1; i >= 0; --i)
			if (points[i].x >= section.start.pos && points[i].x <= section.end.pos)
			{
				var point = points[i];
				interpolatedColormap.AddColor(point.x, point.r * 255.0, point.g * 255.0, point.b * 255.0, point.o * 255.0);
				points.splice(i, 1);
			}
		
		var startPos = Math.max(0, Math.min(size - 1, Math.floor(section.start.pos * size)));
		var endPos = Math.max(0, Math.min(size - 1, Math.floor(section.end.pos * size)));
		var len = endPos - startPos;
		var bytes = interpolatedColormap.Create(len);
		//console.log(startPos);
		//console.log(endPos);
		for (var i = 0; i < len; ++i)
			if (colormapBytes[(startPos + i) * 4 + 3] === 0)
			{
				colormapBytes[(startPos + i) * 4 + 0] = bytes[i * 4 + 0];
				colormapBytes[(startPos + i) * 4 + 1] = bytes[i * 4 + 1];
				colormapBytes[(startPos + i) * 4 + 2] = bytes[i * 4 + 2];
				colormapBytes[(startPos + i) * 4 + 3] = bytes[i * 4 + 3];
			}
	}
	
	this.colormapEnd = function() { }
	
	this.serialize = function()
	{
		// Create a 2D canvas to store the result 
		var tempCanvas = document.createElement('canvas');
		tempCanvas.width = size;
		tempCanvas.height = 1;
		
		// Copy the pixels to a 2D canvas
		var imageData = tempCanvas.getContext('2d').createImageData(size, 1);
		imageData.data.set(colormapBytes);
		tempCanvas.getContext('2d').putImageData(imageData, 0, 0);
		
		return tempCanvas.toDataURL();
	}
}