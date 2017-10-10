

// >>> Section: Global variables and globals


var mattrans = mat4.create(); // General purpose world-view-projection matrix
var matviewproj = mat4.create(); // General purpose view-projection matrix
var viewpos = vec3.create(); // View position
var matworld = mat4.create(), matworld2 = mat4.create(); // General purpose world reorientation matrices
var mattexcoordtrans = mat3.create(); // General purpose texture coordinate transformation matrix
var mattemp = mat4.create(); // General purpose temporary matrix (Do not use across function boundaries)
var mat3temp = mat3.create(); // General purpose temporary 3x3 matrix


// >>> Section: Shaders


function initShader(gl, vsname, fsname)
{
	vertexShader = getShader(gl, vsname);
	fragmentShader = getShader(gl, fsname);

	var sdr = gl.createProgram();
	gl.attachShader(sdr, vertexShader);
	gl.attachShader(sdr, fragmentShader);
	gl.linkProgram(sdr);

	if (!gl.getProgramParameter(sdr, gl.LINK_STATUS)) {
		alert(gl.getProgramInfoLog(sdr));
		return null;
	}

	gl.useProgram(sdr);

	sdr.vertexPositionAttribute = gl.getAttribLocation(sdr, "vpos");
	sdr.vertexNormalAttribute = gl.getAttribLocation(sdr, "aVertexNormal");
	sdr.vertexTangentAttribute = gl.getAttribLocation(sdr, "aVertexTangent");
	sdr.vertexBinormalAttribute = gl.getAttribLocation(sdr, "aVertexBinormal");
	sdr.VertexTexCoordAttribute = gl.getAttribLocation(sdr, "vtexcoord");

	sdr.matWorldViewProjUniform = gl.getUniformLocation(sdr, "matWorldViewProj");
	sdr.matWorldUniform = gl.getUniformLocation(sdr, "matWorld");
	sdr.matWorldInvTransUniform = gl.getUniformLocation(sdr, "matWorldInvTrans");
	sdr.vViewPosUniform = gl.getUniformLocation(sdr, "vViewPos");
	sdr.matTexCoordTransformUniform = gl.getUniformLocation(sdr, "matTexCoordTransform");
	sdr.samplerUniform = gl.getUniformLocation(sdr, "uSampler");
	sdr.samplerArrayUniform = gl.getUniformLocation(sdr, "uSamplerArray");
	sdr.luminanceUniform = gl.getUniformLocation(sdr, "luminance");
	sdr.timeUniform = gl.getUniformLocation(sdr, "time");
	sdr.posUniform = gl.getUniformLocation(sdr, "pos");
	sdr.amplitudeUniform = gl.getUniformLocation(sdr, "amplitude");
	sdr.effectIdUniform = gl.getUniformLocation(sdr, "effectId");
	sdr.effectColorUniform = gl.getUniformLocation(sdr, "effectColor");
	sdr.colorUniform = gl.getUniformLocation(sdr, "color");
	sdr.ambcolorUniform = gl.getUniformLocation(sdr, "ambcolor");
	sdr.diffcolorUniform = gl.getUniformLocation(sdr, "diffcolor");
	sdr.speccolorUniform = gl.getUniformLocation(sdr, "speccolor");
	sdr.lightdirUniform = gl.getUniformLocation(sdr, "lightdir");
	sdr.specpowerUniform = gl.getUniformLocation(sdr, "specpower");

	sdr.InvSizeUniform = gl.getUniformLocation(sdr, "InvSize");
	if(sdr.InvSizeUniform)
		gl.uniform2f(sdr.InvSizeUniform, 1.0 / gl.viewportWidth, 1.0 / gl.viewportHeight);
	sdr.InvTexSizeUniform = gl.getUniformLocation(sdr, "InvTexSize");
	sdr.texboundsUniform = gl.getUniformLocation(sdr, "texbounds");
	if(sdr.texboundsUniform)
		gl.uniform1fv(sdr.texboundsUniform, [-1e20, 1e20, -1e20, 1e20]); // Disable subtexture clamping
	sdr.clampmodeUniform = gl.getUniformLocation(sdr, "clampmode");
	if(sdr.clampmodeUniform)
		gl.uniform1i(sdr.clampmodeUniform, 0); // Disable subtexture clamping
	sdr.BlurOffsetsUniform = gl.getUniformLocation(sdr, "BlurOffsets");
	sdr.BlurWeightsUniform = gl.getUniformLocation(sdr, "BlurWeights");
	sdr.ExBlurWeightsUniform = gl.getUniformLocation(sdr, "ExBlurWeights");
	sdr.dtUniform = gl.getUniformLocation(sdr, "dt");
	sdr.tUniform = gl.getUniformLocation(sdr, "t");
	sdr.IMPRINT_GAIN_Uniform = gl.getUniformLocation(sdr, "IMPRINT_GAIN");
	sdr.IMPRINT_DECAY_Uniform = gl.getUniformLocation(sdr, "IMPRINT_DECAY");
	return sdr
}
function getShader(gl, id) {
	var shaderScript = document.getElementById(id);
	if (!shaderScript) {
		return null;
	}

	var str = "";
	var k = shaderScript.firstChild;
	while (k) {
		if (k.nodeType == 3) {
			str += k.textContent;
		}
		k = k.nextSibling;
	}

	var shader;
	if (shaderScript.type == "x-shader/x-fragment") {
		shader = gl.createShader(gl.FRAGMENT_SHADER);
	} else if (shaderScript.type == "x-shader/x-vertex") {
		shader = gl.createShader(gl.VERTEX_SHADER);
	} else {
		return null;
	}

	gl.shaderSource(shader, str);
	gl.compileShader(shader);

	if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
		alert(gl.getShaderInfoLog(shader));
		return null;
	}

	return shader;
}


// >>> Section: Textures


var COLOR_MAP_NAMES = ["8_30T1", "8_31f", "9_17e", "15b2Asy", "62c", "CIELAB", "debug", "Fav6", "gray5", "grays4_25", "GrGold", "upuFinal", "W5", "yel15"];
function LoadColorMaps(gl, onload)
{
	var texColorTable = new Array(COLOR_MAP_NAMES.Length);
	var i = 0;
	COLOR_MAP_NAMES.forEach(function(colorMapName) {
		texColorTable[i++] = LoadTexture(gl, "color_tables/" + colorMapName + ".png", onload);
	});
	return texColorTable;
}
function handleLoadedTexture(gl, texture, onload)
{
	gl.bindTexture(gl.TEXTURE_2D, texture);
	gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
	gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, texture.image);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
	gl.bindTexture(gl.TEXTURE_2D, null);
	
	if(typeof(onload) == 'function')
		onload(texture);
}
function LoadTexture(gl, filename, onload)
{
	var texture = gl.createTexture();
	texture.image = new Image();
	texture.image.onload = function() {handleLoadedTexture(gl, texture, onload)}
	texture.image.src = filename;
	return texture;
}
function LoadTextureFromImage(gl, image)
{
	var texture = gl.createTexture();
	texture.image = image;
	handleLoadedTexture(gl, texture, null);
	return texture;
}
function LoadTextureFromByteArray(gl, array, width, height)
{
	var texture = gl.createTexture();
	texture.byteArray = array;
	gl.bindTexture(gl.TEXTURE_2D, texture);
	gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
	gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, array);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
	gl.bindTexture(gl.TEXTURE_2D, null);
	return texture;
}
function LoadTextureFromFloatArray(gl, array, width, height)
{
	if (gl.getExtension('OES_texture_float') === null)
	{
		assert("This browser doesn't support floatingpoint textures");
		return null;
	}
	var texture = gl.createTexture();
	texture.floatArray = array;
	gl.bindTexture(gl.TEXTURE_2D, texture);
	gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
	gl.texImage2D(gl.TEXTURE_2D, 0, gl.LUMINANCE, width, height, 0, gl.LUMINANCE, gl.FLOAT, array);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
	gl.bindTexture(gl.TEXTURE_2D, null);
	return texture;
}


// >>> Section: Fonts


var fntNumeric, fntScore, fntDefault;
function initFonts(gl)
{
	/*fntNumeric = new GlNumberFont(gl, "fntNumeric.png", SCORE_FONT_DEF, true);
	fntScore = new GlNumberFont(gl, "fntScore.png", SCORE_FONT_DEF, true);
	fntDefault = new GlTextFont(gl, "fntDefault.png", DEFAULT_FONT_SIZE);*/
}


// >>> Section: Meshes


function Mesh(_gl, positions, normals, tangents, binormals, texcoords, indices, _primitivetype)
{
	var gl = _gl;
	var posbuffer, nmlbuffer, tgtbuffer, bnmbuffer, texcoordbuffer, idxbuffer;
	var primitivetype, numvertices, numindices;

	this.reset = function(positions, normals, tangents, binormals, texcoords, indices, _primitivetype)
	{
		primitivetype = _primitivetype;
		numvertices = Math.floor(positions.length / 3);
		numindices = 0;

		if(!posbuffer)
			posbuffer = gl.createBuffer();
		gl.bindBuffer(gl.ARRAY_BUFFER, posbuffer);
		gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(positions), gl.STATIC_DRAW);
		if(normals)
		{
			if(!nmlbuffer)
				nmlbuffer = gl.createBuffer();
			gl.bindBuffer(gl.ARRAY_BUFFER, nmlbuffer);
			gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(normals), gl.STATIC_DRAW);
		}
		else if(!nmlbuffer)
			gl.deleteBuffer(nmlbuffer);
		if(tangents)
		{
			if(!tgtbuffer)
				tgtbuffer = gl.createBuffer();
			gl.bindBuffer(gl.ARRAY_BUFFER, tgtbuffer);
			gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(tangents), gl.STATIC_DRAW);
		}
		else if(!tgtbuffer)
			gl.deleteBuffer(tgtbuffer);
		if(binormals)
		{
			if(!bnmbuffer)
				bnmbuffer = gl.createBuffer();
			gl.bindBuffer(gl.ARRAY_BUFFER, bnmbuffer);
			gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(binormals), gl.STATIC_DRAW);
		}
		else if(!bnmbuffer)
			gl.deleteBuffer(bnmbuffer);
		if(texcoords)
		{
			if(!texcoordbuffer)
				texcoordbuffer = gl.createBuffer();
			gl.bindBuffer(gl.ARRAY_BUFFER, texcoordbuffer);
			gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(texcoords), gl.STATIC_DRAW);
		}
		else if(!texcoordbuffer)
			gl.deleteBuffer(texcoordbuffer);
		if(indices)
		{
			if(!idxbuffer)
				idxbuffer = gl.createBuffer();
			gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, idxbuffer);
			gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(indices), gl.STATIC_DRAW);
			numindices = indices.length;
			if(!primitivetype)
				primitivetype = gl.TRIANGLES; // Default primitive type for indexed geometry is TRIANGLES
		}
		else
		{
			if(!idxbuffer)
				gl.deleteBuffer(idxbuffer);
			if(!primitivetype)
				primitivetype = gl.TRIANGLE_STRIP; // Default primitive type for non-indexed geometry is TRIANGLE_STRIP
		}
	}
	if(positions) // Mesh vertex positions array can't be null
		this.reset(positions, normals, tangents, binormals, texcoords, indices, _primitivetype);

	this.bind = function(sdr, texture)
	{
		if(!posbuffer) // Mesh without vertex positions can't be rendered
			return;

		for(var i = 0; i < 16; i++)
			gl.disableVertexAttribArray(i);

		gl.enableVertexAttribArray(sdr.vertexPositionAttribute);
		gl.bindBuffer(gl.ARRAY_BUFFER, posbuffer);
		gl.vertexAttribPointer(sdr.vertexPositionAttribute, 3, gl.FLOAT, false, 0, 0);
		if(nmlbuffer && sdr.vertexNormalAttribute != -1)
		{
			gl.enableVertexAttribArray(sdr.vertexNormalAttribute);
			gl.bindBuffer(gl.ARRAY_BUFFER, nmlbuffer);
			gl.vertexAttribPointer(sdr.vertexNormalAttribute, 3, gl.FLOAT, false, 0, 0);
		}
		if(tgtbuffer && sdr.vertexTangentAttribute != -1)
		{
			gl.enableVertexAttribArray(sdr.vertexTangentAttribute);
			gl.bindBuffer(gl.ARRAY_BUFFER, tgtbuffer);
			gl.vertexAttribPointer(sdr.vertexTangentAttribute, 3, gl.FLOAT, false, 0, 0);
		}
		if(bnmbuffer && sdr.vertexBinormalAttribute != -1)
		{
			gl.enableVertexAttribArray(sdr.vertexBinormalAttribute);
			gl.bindBuffer(gl.ARRAY_BUFFER, bnmbuffer);
			gl.vertexAttribPointer(sdr.vertexBinormalAttribute, 3, gl.FLOAT, false, 0, 0);
		}
		if(texcoordbuffer && sdr.VertexTexCoordAttribute != -1)
		{
			gl.enableVertexAttribArray(sdr.VertexTexCoordAttribute);
			gl.bindBuffer(gl.ARRAY_BUFFER, texcoordbuffer);
			gl.vertexAttribPointer(sdr.VertexTexCoordAttribute, 2, gl.FLOAT, false, 0, 0);
		}
		if(texture)
		{
			if(isArray(texture))
			{
				if(sdr.samplerArrayUniform)
				{
					var idxarray = new Array(i);
					for(var i = 0; i < texture.length; i++)
					{
						gl.activeTexture(gl.TEXTURE0 + i);
						gl.bindTexture(gl.TEXTURE_2D, texture[i]);
						idxarray[i] = i;
					}
					gl.uniform1iv(sdr.samplerArrayUniform, idxarray);
				}
			}
			else
			{
				gl.activeTexture(gl.TEXTURE0);
				gl.bindTexture(gl.TEXTURE_2D, texture);
				if(sdr.samplerUniform)
					gl.uniform1i(sdr.samplerUniform, 0);
				if(sdr.samplerArrayUniform)
					gl.uniform1iv(sdr.samplerArrayUniform, [0]);
			}
		}
		if(idxbuffer)
			gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, idxbuffer);
	}

	this.draw = function()
	{
		if(!posbuffer) // Mesh without vertex positions can't be rendered
			return;

		if(idxbuffer)
			gl.drawElements(primitivetype, numindices, gl.UNSIGNED_SHORT, 0);
		else
			gl.drawArrays(primitivetype, 0, numvertices);
	}

	this.free = function()
	{
		if(posbuffer)
		{
			gl.deleteBuffer(posbuffer);
			posbuffer = null;
		}
		if(nmlbuffer)
		{
			gl.deleteBuffer(posbuffer);
			posbuffer = null;
		}
		if(tgtbuffer)
		{
			gl.deleteBuffer(posbuffer);
			posbuffer = null;
		}
		if(bnmbuffer)
		{
			gl.deleteBuffer(posbuffer);
			posbuffer = null;
		}
		if(texcoordbuffer)
		{
			gl.deleteBuffer(posbuffer);
			posbuffer = null;
		}
		if(idxbuffer)
		{
			gl.deleteBuffer(posbuffer);
			posbuffer = null;
		}
	}
}
function CreateQuadMesh(gl)
{
	// Create a 2D quad mesh
	var positions = [
		0.0, 1.0, 0.0,
		0.0, 0.0, 0.0,
		1.0, 1.0, 0.0,
		1.0, 0.0, 0.0
	];
	var texcoords = [
		0.0, 1.0,
		0.0, 0.0,
		1.0, 1.0,
		1.0, 0.0
	];
	return new Mesh(gl, positions, null, null, null, texcoords);
}
function CreateLineQuadMesh(gl)
{
	// Create a 2D quad mesh
	var positions = [
		0.0, 0.0, 0.0,
		1.0, 0.0, 0.0,
		1.0, 1.0, 0.0,
		0.0, 1.0, 0.0
	];
	return new Mesh(gl, positions, null, null, null, null, null, gl.LINE_LOOP);
}
function CreateGridMesh(gl)
{
	// Create a 2D quad mesh
	var positions = [];
	for(var y = 0; y <= 10; ++y)
		[].push.apply(positions, [0.0, 1.0 + 9.0 * y / 10.0, 0.0, 1.0, 1.0 + 9.0 * y / 10.0, 0.0]);
	for(var x = 0; x <= 10; ++x)
		[].push.apply(positions, [x / 10, 1.0 + 9.0 * 0.0, 0.0, x / 10, 1.0 + 9.0 * 1.0, 0.0]);
	return new Mesh(gl, positions, null, null, null, null, null, gl.LINES);
}

function webGLStart(canvas)
{
	var gl = WebGLUtils.setupWebGL(canvas);
	if(!gl)
		return;
	initFonts(gl);

	gl.disable(gl.CULL_FACE);
	gl.disable(gl.BLEND);
	gl.clearColor(0.0, 0.0, 0.0, 0.0);
	
	return gl;
}

/*function setColorMap(gl, sdr, sections, getSectionTexture)
{
	if(sections == null || sections.length == 0)
		return;
	
	gl.useProgram(sdr);
	
	var idxArray = new Array(sections.length);
	var sectionStartArray = new Array(sections.length);
	var sectionEndArray = new Array(sections.length);
	var sectionStartValueArray = new Array(sections.length);
	var sectionEndValueArray = new Array(sections.length);
	var sectionFlippedArray = new Array(sections.length);
	var sectionStartAlphaArray = new Array(sections.length);
	var sectionEndAlphaArray = new Array(sections.length);
	for(var i = 0; i < sections.length; i++)
	{
		gl.activeTexture(gl.TEXTURE0 + (i + 1));
		gl.bindTexture(gl.TEXTURE_2D, getSectionTexture(sections[i]));
		idxArray[i] = i + 1;
		sectionStartArray[i] = sections[i].start.pos;
		sectionEndArray[i] = sections[i].end.pos;
		sectionStartValueArray[i] = sections[i].startValue;
		sectionEndValueArray[i] = sections[i].endValue;
		sectionFlippedArray[i] = sections[i].flipped;
		sectionStartAlphaArray[i] = sections[i].startAlpha;
		sectionEndAlphaArray[i] = sections[i].endAlpha;
	}
	gl.uniform1iv(gl.getUniformLocation(sdr, "colorMap"), idxArray);
	gl.uniform1fv(gl.getUniformLocation(sdr, "colorMapStart"), sectionStartArray);
	gl.uniform1fv(gl.getUniformLocation(sdr, "colorMapEnd"), sectionEndArray);
	gl.uniform1fv(gl.getUniformLocation(sdr, "colorMapStartValue"), sectionStartValueArray);
	gl.uniform1fv(gl.getUniformLocation(sdr, "colorMapEndValue"), sectionEndValueArray);
	gl.uniform1iv(gl.getUniformLocation(sdr, "colorMapFlipped"), sectionFlippedArray);
	gl.uniform1fv(gl.getUniformLocation(sdr, "colorMapStartAlpha"), sectionStartAlphaArray);
	gl.uniform1fv(gl.getUniformLocation(sdr, "colorMapEndAlpha"), sectionEndAlphaArray);
}*/
var MAX_NUM_SECTIONS = 15;
function setColorMap(gl, sdr, sections, getSectionTexture)
{
	if(sections == null || sections.length == 0)
		return;
	
	gl.useProgram(sdr);
	
	var idxArray = new Array(MAX_NUM_SECTIONS);
	var sectionStartArray = new Array(MAX_NUM_SECTIONS);
	var sectionEndArray = new Array(MAX_NUM_SECTIONS);
	var sectionStartValueArray = new Array(MAX_NUM_SECTIONS);
	var sectionEndValueArray = new Array(MAX_NUM_SECTIONS);
	var sectionFlippedArray = new Array(MAX_NUM_SECTIONS);
	var sectionStartAlphaArray = new Array(MAX_NUM_SECTIONS);
	var sectionEndAlphaArray = new Array(MAX_NUM_SECTIONS);
	for(var i = 0; i < sections.length; i++)
	{
		gl.activeTexture(gl.TEXTURE0 + (i + 1));
		gl.bindTexture(gl.TEXTURE_2D, getSectionTexture(sections[i]));
		idxArray[i] = i + 1;
		sectionStartArray[i] = sections[i].start.pos;
		sectionEndArray[i] = sections[i].end.pos;
		sectionStartValueArray[i] = sections[i].startValue;
		sectionEndValueArray[i] = sections[i].endValue;
		sectionFlippedArray[i] = sections[i].flipped;
		sectionStartAlphaArray[i] = sections[i].startAlpha;
		sectionEndAlphaArray[i] = sections[i].endAlpha;
	}
	for(var i = sections.length; i < MAX_NUM_SECTIONS; i++)
	{
		idxArray[i] = sections.length;
		sectionStartArray[i] = 1e20;
		sectionEndArray[i] = 1e20;
		sectionStartValueArray[i] = 0;
		sectionEndValueArray[i] = 0;
		sectionFlippedArray[i] = 0;
		sectionStartAlphaArray[i] = 0;
		sectionEndAlphaArray[i] = 0;
	}
	gl.uniform1iv(gl.getUniformLocation(sdr, "colorMap"), idxArray);
	gl.uniform1fv(gl.getUniformLocation(sdr, "colorMapStart"), sectionStartArray);
	gl.uniform1fv(gl.getUniformLocation(sdr, "colorMapEnd"), sectionEndArray);
	gl.uniform1fv(gl.getUniformLocation(sdr, "colorMapStartValue"), sectionStartValueArray);
	gl.uniform1fv(gl.getUniformLocation(sdr, "colorMapEndValue"), sectionEndValueArray);
	gl.uniform1iv(gl.getUniformLocation(sdr, "colorMapFlipped"), sectionFlippedArray);
	gl.uniform1fv(gl.getUniformLocation(sdr, "colorMapStartAlpha"), sectionStartAlphaArray);
	gl.uniform1fv(gl.getUniformLocation(sdr, "colorMapEndAlpha"), sectionEndAlphaArray);
}