function StreamReader(bytes)
{
	var bytes = bytes;
	var index = 0;

	this.readLine = function()
	{
		var str = "";
		while(index < bytes.length && bytes[index] != 0xD && bytes[index] != 0xD)
			str += String.fromCharCode(bytes[index++]);
		if(index + 1 < bytes.length && bytes[index] == 0xD && bytes[index + 1] == 0xA)
			index += 2; // Skip CrLf
		else if(index < bytes.length && (bytes[index] == 0xD || bytes[index + 1] == 0xA))
			++index; // Skip Cr or Lf
		return str;
	}
}

function getBoundsF32(floats)
{
	var fmin = Number.MAX_VALUE, fmax = Number.MIN_VALUE;
	floats.forEach(function(f) {
		fmin = Math.min(fmin, f);
		fmax = Math.max(fmax, f);
	});
	return [fmin, fmax];
}
function getBoundsI16(words)
{
	return [0, 1]; //EDIT
}
function normalizeF32(floats, bounds)
{
	var voffset = -bounds[0], vscale = 1 / (bounds[1] - bounds[0]);
	for(var i = 0, numpixels = floats.length; i < numpixels; ++i)
		floats[i] = (floats[i] + voffset) * vscale;
}
function F32toI24(floats, bounds)
{
	var bytes = new Uint8Array(4 * floats.length);
	var i = 0, vscale = 0xFFFFFE / (bounds[1] - bounds[0]);
	floats.forEach(function(f) {
		var value = Math.floor((f - bounds[0]) * vscale) + 1;
		bytes[i + 0] = (value >> 16) & 0xFF;
		bytes[i + 1] = (value >> 8) & 0xFF;
		bytes[i + 2] = (value >> 0) & 0xFF;
		bytes[i + 3] = 255;
		i += 4;
	});
	return bytes;
}
function F32toI24flipY(floats, bounds, width, height)
{
	var bytes = new Uint8Array(4 * floats.length);
	var i = 0, vscale = 0xFFFFFE / (bounds[1] - bounds[0]);
	for(var y = 0; y < height; ++y)
		for(var x = 0; x < width; ++x)
		{
			var value = Math.floor((floats[(height - y - 1) * width + x] - bounds[0]) * vscale) + 1;
			bytes[i + 0] = (value >> 16) & 0xFF;
			bytes[i + 1] = (value >> 8) & 0xFF;
			bytes[i + 2] = (value >> 0) & 0xFF;
			bytes[i + 3] = 255;
			i += 4;
		}
	return bytes;
}
function I16toI24(words, bounds)
{
	var bytes = new Uint8Array(4 * words.length);
	var i = 0;
	words.forEach(function(word) {
		bytes[i + 0] = 0;
		bytes[i + 1] = (word >> 8) & 0xFF;
		bytes[i + 2] = (word >> 0) & 0xFF;
		bytes[i + 3] = 255;
		i += 4;
	});
	return bytes;
}

function readImImage(bytes)
{
	var sr = new StreamReader(bytes);

	var readline = sr.readLine();
	if(!readline.startsWith("Image type: "))
		return null;
	var imageType = readline.substring("Image type: ".length);

	readline = sr.readLine();
	if(!readline.startsWith("Name: "))
		return null;
	var name = readline.substring("Name: ".length);

	readline = sr.readLine();
	if(!readline.startsWith("Image size (x*y): "))
		return null;
	var imageSize = readline.substring("Image size (x*y): ".length).split('*');
	var width, height;
	if(imageSize.length != 2 || (width = parseInt(imageSize[0])) == NaN || width <= 0 || (height = parseInt(imageSize[1])) == NaN || height <= 0)
		// Error: Illegal value for 'Image size'
		return null;

	readline = sr.readLine();
	if(!readline.startsWith("File size (no of images): "))
		return null;
	var numImages = readline.substring("File size (no of images): ".length);

	var numpixels = width * height;
	var values = new Float32Array(bytes.buffer, 0x200, numpixels);
	var vmin = Number.MAX_VALUE, vmax = Number.MIN_VALUE;
	for(var i = 0; i < numpixels; ++i)
	{
		vmin = Math.min(vmin, values[i]);
		vmax = Math.max(vmax, values[i]);
	}
	var vscale = 0xFFFFFE / (vmax - vmin);

	bytes = new Uint8Array(4 * numpixels);
	var i = 0;
	for(var y = 0; y < height; ++y)
		for(var x = 0; x < width; ++x)
		{
			var value = Math.floor((values[(height - y - 1) * width + x] - vmin) * vscale) + 1;
			bytes[i + 0] = (value >> 16) & 0xFF;
			bytes[i + 1] = (value >> 8) & 0xFF;
			bytes[i + 2] = (value >> 0) & 0xFF;
			bytes[i + 3] = 255;
			i += 4;
		}

	return {
		bytes: bytes,
		width: width,
		height: height,
		vmin: vmin,
		vmax: vmax
	};
}

function readFitsImage(filename, onerr, onreceivebytes, onreceivefloats)
{
	var fits = new astro.FITS(filename, function() {
		var dataunit = this.getDataUnit();
		console.log("width = " + dataunit.width);
		console.log("height = " + dataunit.height);
		console.log("depth = " + dataunit.depth);
		console.log("bzero = " + dataunit.bzero);
		console.log("bscale = " + dataunit.bscale);
		console.log("bitpix = " + dataunit.bitpix);
		dataunit.getFrame(0, function(array) {
			switch(dataunit.bitpix)
			{
			case 16:
				var bounds = getBoundsI16(array);
				array = I16toI24(array, bounds);
				onreceivebytes(array, dataunit.width, dataunit.height, bounds[0], bounds[1]);
				break;
			case -32:
				if(true) //EDIT: if(float texture supported)
				{
					var bounds = getBoundsF32(array);
					normalizeF32(array, bounds);
for(var i = 0, numpixels = array.length; i < numpixels; ++i)
	array[i] = Math.sqrt(array[i]);
					onreceivefloats(array, dataunit.width, dataunit.height, bounds[0], bounds[1]);
				}
				else
				{
					var bounds = getBoundsF32(array);
					array = F32toI24(array, bounds);
					onreceivebytes(array, dataunit.width, dataunit.height, bounds[0], bounds[1]);
				}
				break;
			default:
				onerr("FIPS pixel format not implemented: " + dataunit.bitpix);
			}
		});
	});
}