// Reference white-point D65
var XYZn = [95.047, 100.0, 108.883]; // from Adobe Cookbook

// Transfer-matrix for the conversion of RGB to XYZ color space
var transM = [0.4124564, 0.2126729, 0.0193339,
			  0.3575761, 0.7151522, 0.1191920,
			  0.1804375, 0.0721750, 0.9503041];
var invTransM = mat3.create();
mat3.invert(invTransM, transM);

function rgblinear(rgb)
{
	// Conversion from the sRGB components to RGB components with physically linear properties.

	// iInitialize the linear RGB array
	var rgbLinear = [0.0, 0.0, 0.0];

	// Calculate the linear RGB values
	for(var i = 0; i < 3; ++i)
	{
		var value = rgb[i];
		value = value / 255.0;
		if(value > 0.04045)
			value = Math.pow((value + 0.055) / 1.055, 2.4);
		else
			value = value / 12.92;
		rgbLinear[i] = value * 100.0;
	}
	return rgbLinear;
}

function srgb(rgbLinear)
{
	// Back conversion from linear RGB to sRGB.

	// Initialize the sRGB array
	var rgb = [0.0, 0.0, 0.0];

	// Calculate the sRGB values
	for(var i = 0; i < 3; ++i)
	{
		var value = rgbLinear[i];
		value = value / 100.0;

		if(value > 0.00313080495356037152)
			value = (1.055 * Math.pow(value, 1.0 / 2.4)) - 0.055;
		else
			value = value * 12.92;

		rgb[i] = Math.round(value * 255.0);
	}
	return rgb;
}

function rgb2xyz(rgb)
{
	// Conversion of RGB to XYZ using the transfer-matrix
	var xyz = vec3.create();
	vec3.transformMat3(xyz, rgblinear(rgb), transM);
	return xyz;
}

function xyz2rgb(xyz)
{
	// Conversion of RGB to XYZ using the transfer-matrix
	var rgbLinear = vec3.create();
	vec3.transformMat3(rgbLinear, xyz, invTransM);
	return srgb(rgbLinear);
}

function rgb2lab(rgb)
{
	// Conversion of RGB to CIELAB

	// Convert RGB to XYZ
	var xyz = rgb2xyz(rgb);

	// helper function
	var f = function(x) {
		var limit = 0.008856;
		return x > limit ? Math.pow(x, 1.0 / 3.0) : 7.787 * x + 16.0 / 116.0;
	};

	// Calculation of L, a and b
	var L = 116.0 * (f(xyz[1] / XYZn[1]) - (16.0 / 116.0));
	var a = 500.0 * (f(xyz[0] / XYZn[0]) - f(xyz[1] / XYZn[1]));
	var b = 200.0 * (f(xyz[1] / XYZn[1]) - f(xyz[2] / XYZn[2]));
	return [L, a, b];
}

function lab2rgb(lab)
{
	// Conversion of CIELAB to RGB

	// helper function
	var finverse = function(x) {
		var xlim = 0.008856;
		var a = 7.787;
		var b = 16.0 / 116.0;
		var ylim = a * xlim + b;
		return x > ylim ? Math.pow(x, 3) : ( x - b ) / a;
	};

	// calculation of X, Y and Z
	var X = XYZn[0] * finverse((lab[1] / 500.0) + (lab[0] + 16.0) / 116.0);
	var Y = XYZn[1] * finverse((lab[0] + 16.0) / 116.0);
	var Z = XYZn[2] * finverse((lab[0] + 16.0) / 116.0 - (lab[2] / 200.0));

	// Conversion of XYZ to RGB
	return xyz2rgb([X,Y,Z]);
}

function lab2msh(lab)
{
	// Conversion of CIELAB to Msh

	// calculation of M, s and h
	var M = lab.Length();
	var s = acos(lab[0] / M);
	var h = atan2(lab[2], lab[1]);
	return [M, s, h];
}

function msh2lab(msh)
{
	// Conversion of Msh to CIELAB

	// calculation of L, a and b
	var L = msh[0] * cos(msh[1]);
	var a = msh[0] * sin(msh[1]) * cos(msh[2]);
	var b = msh[0] * sin(msh[1]) * sin(msh[2]);
	return [L, a, b];
}

function rgb2msh(rgb)
{
	// Direct conversion of RGB to Msh
	return lab2msh(rgb2lab(rgb));
}

function msh2rgb(msh)
{
	// Direct conversion of Msh to RGB
	return lab2rgb(msh2lab(msh));
}

function adjustHue(mshSat, munSat)
{
	// Function to provide an adjusted hue when interpolating to an unsaturated color in Msh space

	if(mshSat[0] >= munSat)
		return mshSat[2];
	else
	{
		var hSpin = mshSat[1] * sqrt(munSat*munSat - mshSat[0]*mshSat[0]) / (mshSat[0] * sin(mshSat[1]));
		if(mshSat[2] > -PI / 3.0)
			return mshSat[2] + hSpin;
		else
			return mshSat[2] - hSpin;
	}
}

function interpolateColor(rgb1, rgb2, interp)
{
	// Interpolation algorithm to automatically create continuous diverging color maps.

	// Convert RGB to Msh and unpack
	var msh1 = rgb2msh(rgb1);
	var msh2 = rgb2msh(rgb2);

	// If points saturated and distinct, place white in middle
	if((msh1[1] > 0.05) && (msh2[1] > 0.05) && (Math.abs(msh1[2] - msh2[2]) > PI / 3.0))
	{
		var Mmid = Math.max(Math.max(msh1[0], msh2[0]), 88.0);
		if(interp < 0.5)
		{
			msh2[0] = Mmid;
			msh2[1] = 0.0;
			msh2[2] = 0.0;
			interp = 2 * interp;
		}
		else
		{
			msh1[0] = Mmid;
			msh1[1] = 0.0;
			msh1[2] = 0.0;
			interp = 2.0 * interp - 1.0;
		}
	}

	// Adjust hue of unsaturated colors
	if((msh1[1] < 0.05) && (msh2[1] > 0.05))
		msh1[2] = adjustHue(msh2, msh1[0]);
	else if((msh2[1] < 0.05) && (msh1[1] > 0.05))
		msh2[2] = adjustHue(msh1, msh2[0]);

	// Linear interpolation on adjusted control points
	var msh = vec3.create();
	vec3.lerp(msh, msh1, msh2, interp)
	return msh2rgb(msh);
}

function interpolateLabColor(rgb1, rgb2, interp)
{
	var lab = vec3.create();
	vec3.lerp(lab, rgb2lab(rgb1), rgb2lab(rgb2), interp)
	var rgb = lab2rgb(lab);
	return [rgb[0], rgb[1], rgb[2], rgb2[3] * interp + rgb1[3] * (1.0 - interp)];
}

function InterpolatedColorMap()
{
	var samples = [], keys = [];
	var x_min = Number.MAX_VALUE, x_max = Number.MIN_VALUE;
	this.AddColor = function(x, r, g, b, a)
	{
		x = parseFloat(x);
		x_min = Math.min(x_min, x);
		x_max = Math.max(x_max, x);
		samples[x] = [r, g, b, a];
		keys.push(x);
	}

	this.sample = function(x)
	{
		if(x in samples)
			return samples[x];

		var lowKey = null, highKey = null;
		keys.forEach(function(currentKey) {
			if(highKey !== null)
				return;

			if(currentKey < x)
				lowKey = currentKey;
			else if(currentKey > x)
				highKey = currentKey;
		});

		if(lowKey === null)
			return samples[highKey];
		if(highKey === null)
			return samples[lowKey];
		return interpolateLabColor(samples[lowKey], samples[highKey], (x - lowKey) / (highKey - lowKey));
	}
	this.Create = function(size)
	{
		var colorMap = new Array(size * 4);
		var x_delta = x_max - x_min;

		keys.sort(function(a,b) {return a - b;});
		var normalized_samples = [], normalized_keys = [];
		keys.forEach(function(key) {
			var newkey = (key - x_min) / x_delta;
			normalized_samples[newkey] = samples[key];
			normalized_keys.push(newkey);
		});
		samples = normalized_samples;
		keys = normalized_keys;

		var lastSample = null, lastKey;
		keys.forEach(function(currentKey) {
			var currentSample = samples[currentKey];
			if(lastSample !== null)
			{
				var lastIdx = Math.floor(lastKey * size), currentIdx = Math.floor(currentKey * size), deltaIdx = currentIdx - lastIdx;
				for(var i = 0; i < deltaIdx; ++i)
				{
					var clr = interpolateLabColor(lastSample, currentSample, i / deltaIdx);
					var idx = lastIdx + i;
					colorMap[4 * idx + 0] = clr[0];
					colorMap[4 * idx + 1] = clr[1];
					colorMap[4 * idx + 2] = clr[2];
					colorMap[4 * idx + 3] = clr[3];
				}
			}

			lastSample = currentSample;
			lastKey = currentKey;
		});

		return colorMap;
	}

	this.getSamples = function()
	{
		return samples;
	}
	this.getKeys = function()
	{
		return keys;
	}
}