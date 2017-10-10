function ImageCanvas(canvas, div)
{
	var THUMBNAIL_SIZE = 48;
	
	this.canvas = canvas;
	this.div = div;
	var gl = webGLStart(canvas);
	gl.enable(gl.BLEND);
	//gl.blendEquation(gl.FUNC_ADD);
	//gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
	gl.blendEquationSeparate(gl.FUNC_ADD, gl.FUNC_ADD);
	gl.blendFuncSeparate(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA, gl.ONE, gl.ONE);
	
	var divImageControlSection = document.getElementById("ImageControlSection");
	divImageControlSection.style.visibility = 'hidden';
	divImageControlSection.onmouseleave = function() { fadeOut(divImageControlSection); };
	
	var sdrFloat = initShader(gl, "vsSimple", "fsColorMapping");
	var sdrTextured = initShader(gl, "vsSimple", "fsSimple");
	var sdrLine = initShader(gl, "vsSimple", "fsLine");
	var meshquad = CreateQuadMesh(gl);
	var meshLineQuad = CreateLineQuadMesh(gl);
	
	var views = [new View(0.0, 0.0, 1.0, 1.0, null, null)];
	views[0].init();
	
	var controlsAlpha = 0.0;

var fb = gl.createFramebuffer();

	RegisterMouseHandler(this, canvas);

	var highlightRect = new function()
	{
		var rect = document.createElement("div");
		rect.id = "ImageFrame";
		div.appendChild(rect);

		this.show = function(x, y, width, height)
		{
			rect.style.left = x + 8; // 8 ... Margin of canvas
			rect.style.top = y + 8; // 8 ... Margin of canvas
			rect.style.width = width - 2; // -2 ... Subtract border of canvas
			rect.style.height = height - 2; // -2 ... Subtract border of canvas
			rect.style.display = "inline-block";
		}
		this.hide = function()
		{
			rect.style.display = "none";
		}
	};
	var viewFromPoint = function(x, y, includeNewViews, createNewView)
	{
		x /= canvas.width; // Make relative to canvas
		y /= canvas.height; // Make relative to canvas
		var v = null;
		views.forEach(function(view) {
			if (x >= view.x && y >= view.y && x < view.x + view.width && y < view.y + view.height)
			{
				if (includeNewViews !== true)
				{
					v = view;
					return;
				}
				var xr = (x - view.x) / view.width; // Make relative to view
				var yr = (y - view.y) / view.height; // Make relative to view
				if (xr < yr && xr < 0.1)
				{
					v = new View(view.x, view.y, view.width / 2, view.height, view, null);
					if (createNewView === true)
					{
						view.width /= 2;
						view.x += view.width;
						view.sibling2 = v;
						view.onResize();
						views.push(v);
						v.init();
					}
					return;
				}
				else if (yr < 0.1)
				{
					v = new View(view.x, view.y, view.width, view.height / 2, view, null);
					if (createNewView === true)
					{
						view.height /= 2;
						view.y += view.height;
						view.sibling2 = v;
						view.onResize();
						views.push(v);
						v.init();
					}
					return;
				}

				xr = 1 - xr;
				yr = 1 - yr;
				if (xr < yr && xr < 0.1)
				{
					v = new View(view.x + view.width / 2, view.y, view.width / 2, view.height, view, null);
					if (createNewView === true)
					{
						view.width /= 2;
						view.sibling2 = v;
						view.onResize();
						views.push(v);
						v.init();
					}
					return;
				}
				else if (yr < 0.1)
				{
					v = new View(view.x, view.y + view.height / 2, view.width, view.height / 2, view, null);
					if (createNewView === true)
					{
						view.height /= 2;
						view.sibling2 = v;
						view.onResize();
						views.push(v);
						v.init();
					}
					return;
				}
				
				v = view;
				return;
			}
		});
		return v; // (x|y) is outside of all views
	}
	this.showHighlight = function(x, y)
	{
		var view = viewFromPoint(x, y, true, false);
		if (view != null)
			highlightRect.show(view.x * canvas.width,
							   view.y * canvas.height,
							   view.width * canvas.width,
							   view.height * canvas.height);
	}
	this.hideHighlight = function()
	{
		highlightRect.hide();
	}
	this.getOrCreateView = function(x, y)
	{
		return viewFromPoint(x, y, true, true);
	}

	this.loadColorMapTextures = function()
	{
		var i = 0;
		for(var colorMapName in colorMaps)
			if(colorMaps[colorMapName].texI == null)
				colorMaps[colorMapName].texI = LoadTextureFromByteArray(gl, new Uint8Array(colorMaps[colorMapName].bytes), colorMaps[colorMapName].bytes.length / 4, 1);
	}

	function View(x, y, width, height, sibling1, sibling2)
	{
		this.x = x;
		this.y = y;
		this.width = width;
		this.height = height;
		this.sibling1 = sibling1;
		this.sibling2 = sibling2;
		
		var images = [];
		var currentImageIndex = 0;
		var currentImage = null;
		var transform = mat4.create();

		var closeButton = null;
		
		this.init = function()
		{
			closeButton = document.createElement('input');
			closeButton.id = "ImageCloseButton";
			closeButton.type = "image";
			closeButton.src = "closeButton.png";
			closeButton.onclick = closeButton_onclick.bind(this);
			closeButton.onmouseleave = function() { fadeOut(closeButton); };
			closeButton.style.visibility = 'hidden';
			div.appendChild(closeButton);

			this.onResize();
		}
		this.free = function()
		{
			if (closeButton !== null)
			{
				div.removeChild(closeButton);
				closeButton = null;
			}
		}

		function closeButton_onclick()
		{
			// Choose sibling to expand
			var sibling;
			if (this.sibling1 !== null && this.sibling2 !== null)
				sibling = views.indexOf(this.sibling1) > views.indexOf(this.sibling2) ? this.sibling1 : this.sibling2;
			else if (this.sibling1 !== null)
				sibling = this.sibling1;
			else if (this.sibling2 !== null)
				sibling = this.sibling2;
			else
			{
				alert("Attempting to remove a view without siblings");
				return;
			}

			// Sibling bounds = union(this view's bounds, sibling bounds)
			sibling.width = Math.max(sibling.x + sibling.width, this.x + this.width);
			sibling.height = Math.max(sibling.y + sibling.height, this.y + this.height);
			sibling.x = Math.min(sibling.x, this.x);
			sibling.y = Math.min(sibling.y, this.y);
			sibling.width -= sibling.x;
			sibling.height -= sibling.y;
			sibling.onResize();

			// Unlink this view from siblings
			if (this.sibling1 !== null)
				this.sibling1.sibling2 = this.sibling2;
			if (this.sibling2 !== null)
				this.sibling2.sibling1 = this.sibling1;
			
			// Remove this view from parent views
			var viewIdx = views.indexOf(this);
			if (viewIdx !== -1)
				views.splice(viewIdx, 1);
			
			// Cleanup this view
			this.free();
			
			// Rebuild histograms
			setHistogramResolution();
			
			requestAnimFrame(render);
		}

		this.render = function(renderingToFile)
		{
			if(currentImage == null)
				return;
			var sdr = null;
			
			currentImage.layers.forEach(function(layer) {
				if(layer.sdr !== sdr)
				{
					gl.useProgram(sdr = layer.sdr);
setColorMap(gl, sdr, sections, function(section) {return section.colorMap.texI;}); // Bugfix
				}
				if (sdr === sdrFloat)
					gl.uniform2f(gl.getUniformLocation(sdrFloat, "InvSize"), 1.0 / layer.width, 1.0 / layer.height);
				
				var mattrans = mat4.create();
				mat4.identity(mattrans);
				if(renderingToFile === true)
					mat4.scale(mattrans, mattrans, [2.0 * layer.width / gl.viewportWidth, -2.0 * layer.height / gl.viewportHeight, 1.0]);
				else
				{
					mat4.mul(mattrans, mattrans, transform);
					mat4.scale(mattrans, mattrans, [2.0 * layer.width / (this.width * gl.viewportWidth), 2.0 * layer.height / (this.height * gl.viewportHeight), 1.0]);
				}
				mat4.translate(mattrans, mattrans, [-0.5, -0.5, 0.0]);
				gl.uniformMatrix4fv(sdr.matWorldViewProjUniform, false, mattrans);
				
				meshquad.bind(sdr, layer.tex);
				meshquad.draw();
			}, this);
		}

		this.zoomReset = function()
		{
			transform[0] = transform[5] = 1.0;
			this.restricTransform(transform);
			requestAnimFrame(render);
		}
		this.zoomFit = function()
		{
			if(currentImage == null)
				return;
			
			var t0_fit = canvas.width * this.width / currentImage.width;
			var t5_fit = canvas.height * this.height / currentImage.height;

			transform[0] = transform[5] = Math.min(t0_fit, t5_fit);
			this.restricTransform(transform);
			requestAnimFrame(render);
		}
		this.zoomDefault = function()
		{
			if(currentImage == null)
				return;
			
			var t0_fit = canvas.width * this.width / currentImage.width;
			var t5_fit = canvas.height * this.height / currentImage.height;

			transform[0] = transform[5] = Math.min(t0_fit, t5_fit, 1.0);
			this.restricTransform(transform);
			requestAnimFrame(render);
		}

		this.restricTransform = function(transform)
		{
			if(currentImage == null)
				return;
			
			if (transform[0] * currentImage.width < canvas.width * this.width) // If image width < view width
				transform[12] = 0.0; // Center image horizontally
			else // If image width >= view width
			{
				var sign_x = Math.sign(transform[12]);
				var dist_x = ((1.0 + sign_x * transform[12]) * canvas.width * this.width - currentImage.width * transform[0]) / 2.0; // Compute distance to nearest border [pixels] -> dist
				if (dist_x > 0.0)
					transform[12] = (currentImage.width * transform[0] / (canvas.width * this.width) - 1.0) * sign_x; // Move image, so image border aligns with screen border
			}
			if (transform[5] * currentImage.height < canvas.height * this.height) // If image height < view height
				transform[13] = 0.0; // Center image vertically
			else // If image height >= view height
			{
				var sign_y = Math.sign(transform[13]);
				var dist_y = ((1.0 + sign_y * transform[13]) * canvas.height * this.height - currentImage.height * transform[5]) / 2.0; // Compute distance to nearest border [pixels] -> dist
				if (dist_y > 0.0)
					transform[13] = (currentImage.height * transform[5] / (canvas.height * this.height) - 1.0) * sign_y; // Move image, so image border aligns with screen border
			}
		}

		this.onMouseDown = function(canvas, clientX, clientY, which)
		{
			canvas.style.cursor = 'move';
			
			var xr = 1.0 - 2.0 * (clientX / canvas.width - this.x) / this.width; // xr = mouse position in device space ([-1, 1])
			var yr = 2.0 * (clientY / canvas.height - this.y) / this.height - 1.0; // yr = mouse position in device space ([-1, 1])
			
			var transform_noscale = mat4.create();
			mat4.copy(transform_noscale, transform);
			transform_noscale[0] = 1.0; transform_noscale[5] = 1.0;
			
			var t0 = vec3.create(), tm = vec3.create();
			vec3.transformMat4(tmd0, [xr, yr, 0.0], transform_noscale);
		}

		this.onMouseMove = function(canvas, clientX, clientY, pressedmousebuttons)
		{
			if(canvas.style.cursor == 'move')//(pressedmousebuttons[1])
			{
				var xr = 1.0 - 2.0 * (clientX / canvas.width - this.x) / this.width; // xr = mouse position in device space ([-1, 1])
			var yr = 2.0 * (clientY / canvas.height - this.y) / this.height - 1.0; // yr = mouse position in device space ([-1, 1])
				
				var invtransform = mat4.create();
				mat4.invert(invtransform, transform);
				
				var transform_noscale = mat4.create();
				mat4.copy(transform_noscale, transform);
				transform_noscale[0] = 1.0; transform_noscale[5] = 1.0;
				
				var t0 = vec3.create(), tm = vec3.create(), tm0 = vec3.create();
				vec3.transformMat4(tm0, [xr, yr, 0.0], transform_noscale);
				vec3.transformMat4(t0, [0.0, 0.0, 0.0], transform_noscale);
				
				
				vec3.sub(tm0, tmd0, tm0);
				vec3.add(tm0, tm0, t0);
				
				vec3.transformMat4(tm0, tm0, invtransform);
				
				mat4.translate(transform, transform, tm0);

				this.restricTransform(transform);
				requestAnimFrame(render);
			}
			else
			{
				/*if (currentImage !== null && currentImage.layers.length !== 0)
				{
					var mattrans = mat4.create(), pos = [clientX / (this.width * gl.viewportWidth) * 2 - 1, clientY / (this.height * gl.viewportHeight) * 2 - 1];
					mat4.identity(mattrans);
					mat4.mul(mattrans, mattrans, transform);
					mat4.scale(mattrans, mattrans, [2.0 * currentImage.layers[0].width / (this.width * gl.viewportWidth), 2.0 * currentImage.layers[0].height / (this.height * gl.viewportHeight), 1.0]);
					mat4.translate(mattrans, mattrans, [-0.5, -0.5, 0.0]);
					mat4.invert(mattrans, mattrans);
					//console.log(pos);
					vec2.transformMat4(pos, pos, mattrans);
					//console.log(pos);

					pos[1] = 1.0 - pos[1];

					if(pos[0] >= 0.0 && pos[0] < 1.0 && pos[1] >= 0.0 && pos[1] < 1.0)
					{
						gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
						gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, currentImage.layers[0].tex, 0);
						var canRead = (gl.checkFramebufferStatus(gl.FRAMEBUFFER) == gl.FRAMEBUFFER_COMPLETE);
						if(canRead)
						{
							var pixels = new Uint8Array(4);
							gl.readPixels(pos[0] * currentImage.layers[0].width, pos[1] * currentImage.layers[0].height, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
							if (pixels[3] !== 0)
							{
								var valueI = pixels[0] << 16 | pixels[1] << 8 | pixels[2];
								if (valueI !== 0)
								{
									var valueS = (valueI - 1) / 0xFFFFFE;
									console.log(valueS);
									colorMapCanvas.highlightValue(valueS, 100);
									imageCanvas.highlightValue(valueS);
								}
							}
						}
						gl.bindFramebuffer(gl.FRAMEBUFFER, null);
					}
				}*/

				var closeButtonBounds = closeButton.getBoundingClientRect();
				var canvasBounds = canvas.getBoundingClientRect();
				if(views.length >= 2 &&
				   canvasBounds.left + clientX >= closeButtonBounds.left &&
				   canvasBounds.top + clientY >= closeButtonBounds.top &&
				   canvasBounds.left + clientX < closeButtonBounds.right &&
				   canvasBounds.top + clientY < closeButtonBounds.bottom)
						fadeIn(closeButton);
			}
		}

		this.onMouseLeave = function(canvas, clientX, clientY, pressedmousebuttons)
		{
			var closeButtonBounds = closeButton.getBoundingClientRect();
			var canvasBounds = canvas.getBoundingClientRect();
			if(canvasBounds.left + clientX < closeButtonBounds.left ||
			canvasBounds.top + clientY < closeButtonBounds.top ||
			canvasBounds.left + clientX >= closeButtonBounds.right ||
			canvasBounds.top + clientY >= closeButtonBounds.bottom)
				fadeOut(closeButton);
		}

		this.onMouseWheel = function(canvas, clientX, clientY, deltaZ, which)
		{
			var xr = 1.0 - 2.0 * (clientX / canvas.width - this.x) / this.width; // xr = mouse position in device space ([-1, 1])
			var yr = 2.0 * (clientY / canvas.height - this.y) / this.height - 1.0; // yr = mouse position in device space ([-1, 1])
		
			// >>> Mouse centered zoom
			// tm0 = vector from coordinate system center to mouse position in transform space
			// Algorithm:
			// 1) Translate image center to mouse cursor
			// 2) Zoom
			// 3) Translate back
			
			var invtransform = mat4.create();
			mat4.invert(invtransform, transform);
			
			var transform_noscale = mat4.create();
			mat4.copy(transform_noscale, transform);
			transform_noscale[0] = 1.0; transform_noscale[5] = 1.0;
			
			var t0 = vec3.create(), tm = vec3.create(), tm0 = vec3.create(), tm0n = vec3.create();
			vec3.transformMat4(t0, [0.0, 0.0, 0.0], transform_noscale);
			vec3.transformMat4(tm, [xr, yr, 0.0], transform_noscale);
			vec3.sub(tm0, t0, tm);
			vec3.transformMat4(tm0, tm0, invtransform);
			vec3.negate(tm0n, tm0);
			
			var zoom = 1.0 - deltaZ / 50.0;
			mat4.translate(transform, transform, tm0);
			mat4.scale(transform, transform, [zoom, zoom, 1.0]);
			/*if(transform[0] < 1.0) // If zoomed out more than zoom == 1.0
			{
				zoom = 1.0 / transform[0];
				mat4.scale(transform, transform, [zoom, zoom, 1.0]);
			}*/
			mat4.translate(transform, transform, tm0n);

			this.restricTransform(transform);
			requestAnimFrame(render);
		}

		this.onResize = function()
		{
			if (closeButton !== null)
			{
				closeButton.style.right = 8 + (1 - this.x - this.width) * (canvas.width - 2); // 8 ... Margin of canvas, -2 ... Subtract border of canvas
				closeButton.style.top = 8 + this.y * canvas.height; // 8 ... Margin of canvas
			}
			this.restricTransform(transform);
		}

		this.createHistogram = function(size)
		{
			if(currentImage == null)
				return null;
			var histogram = Array.apply(null, Array(size)).map(Number.prototype.valueOf, 0);
			var numpixels = 0;
			
			currentImage.layers.forEach(function(layer) {
				if(layer.sdr === sdrFloat)
				{
					if(layer.tex.image != null)
					{
						// Draw layer.tex.image to in-memory canvas to extract bytes
						var canvas = document.createElement('canvas');
						canvas.width = layer.width;
						canvas.height = layer.height;
						canvas.getContext('2d').drawImage(layer.tex.image, 0, 0, layer.width, layer.height);
						var bytes = canvas.getContext('2d').getImageData(0, 0, layer.width, layer.height).data;
						
						for(var i = 0; i < bytes.length; i += 4)
						{
							var value = ColorToValue(bytes, i);
							if(!isNaN(value))
							{
								var idx = Math.floor(size * value);
								++histogram[idx < size ? idx : size - 1];
							}
						}
						numpixels += layer.width * layer.height;
					}
					else if(layer.tex.byteArray != null)
					{
						var bytes = layer.tex.byteArray;
						for(var i = 0; i < bytes.length; i += 4)
						{
							var value = ColorToValue(bytes, i);
							if(!isNaN(value))
							{
								var idx = Math.floor(size * value);
								++histogram[idx < size ? idx : size - 1];
							}
						}
						numpixels += layer.width * layer.height;
					}
					else if(layer.tex.floatArray != null)
					{
						layer.tex.floatArray.forEach(function(value) {
							if(!isNaN(value))
							{
								var idx = Math.floor(size * value);
								++histogram[idx < size ? idx : size - 1];
							}
						});
						numpixels += layer.width * layer.height;
					}
				}
			});
			if (numpixels === 0)
				return null;
			
			/*// Normalize by pixel count
			for(var i = 0; i < size; ++i)
				histogram[i] /= numpixels;*/
				
			/*// Normalize by maximum value
			for(var i = 0; i < size; ++i)
				histogram[i] /= histogramMax;*/
			
			// Normalize by maximum histogram value, ignoring the first and last value,
			// because they might be unproportionally large due to being the sum of all values below/above the data range
			var histogramMax = 0.0;
			for(var i = 1; i < size - 1; ++i)
				histogramMax = Math.max(histogramMax, histogram[i]);
			for(var i = 0; i < size; ++i)
				histogram[i] /= histogramMax;
			
			return {values: histogram, maxPercentage: histogramMax / numpixels};
		}
		
		var guessImageLayout = function(tex, width, height)
		{
			var bytes;
			if(tex.image != null)
			{
				// Draw tex.image to in-memory canvas to extract bytes
				var canvas = document.createElement('canvas');
				canvas.width = width;
				canvas.height = height;
				canvas.getContext('2d').drawImage(tex.image, 0, 0, width, height);
				bytes = canvas.getContext('2d').getImageData(0, 0, width, height).data;
			}
			else if(tex.byteArray != null)
				bytes = tex.byteArray;
			else if(tex.floatArray != null)
				return 'F32';
			var dataview = new DataView(bytes.buffer);
			
			var ImageLayout = function(parseValue) {
				var minValue = Number.MAX_VALUE, maxValue = Number.MIN_VALUE, prevValue = parseValue(0), diffValue = 0;
				if (Number.isNaN(prevValue)) prevValue = 0;
				this.parse = function(i)
				{
					var value = parseValue(i);
					if (Number.isNaN(value)) value = 0;
					diffValue += Math.abs(value - prevValue);
					minValue = Math.min(minValue, prevValue = value);
					maxValue = Math.max(maxValue, value);
				}
				this.getScore = function()
				{
					return diffValue / (maxValue - minValue);
				}
			};
			var I24 = new ImageLayout(i => (bytes[i + 0] << 16) | (bytes[i + 1] << 8) | (bytes[i + 2]));
			var I24inv = new ImageLayout(i => (bytes[i + 0]) | (bytes[i + 1] << 8) | (bytes[i + 2] << 16));
			var F32 = new ImageLayout(i => dataview.getFloat32(i));
			for(var i = 4; i < bytes.length; i += 4)
			{
				I24.parse(i);
				I24inv.parse(i);
				F32.parse(i);
			}
			console.log('I24', I24.getScore());
			console.log('I24inv', I24inv.getScore());
			console.log('F32', F32.getScore());
			if (I24.getScore() < I24inv.getScore() && I24.getScore() < F32.getScore())
				return 'I24';
			else if (I24inv.getScore() < F32.getScore())
				return 'I24inv';
			else
				return 'F32';
		}
		
		this.loadImage = function(name, tex, width, height, isLayer, isFloatImage)
		{
			console.log(guessImageLayout(tex, width, height));
			var newLayer = {
				tex: tex,
				sdr: isFloatImage === false ? sdrTextured : sdrFloat,
				width: width,
				height: height
			};
			
			if(isLayer === true && images.length != 0)
			{
				currentImage = images[currentImageIndex];
				currentImage.layers.push(newLayer);
				currentImage.width = Math.max(currentImage.width, newLayer.width);
				currentImage.height = Math.max(currentImage.height, newLayer.height);
			}
			else
			{
				currentImageIndex = images.length;
				currentImage = {name: name, layers: [], width: newLayer.width, height: newLayer.height};
				currentImage.layers.push(newLayer);
				images.push(currentImage);
			}
			
			if (currentImage.layers.length >= 2) { // If this image contains at least two layers
				currentImage.layers[0].sdr = sdrTextured; // Make background layer a non-float image
			}
			
			this.zoomDefault();
			requestAnimFrame(render);
		}
		this.prevImage = function()
		{
			if(currentImageIndex > 0 && images.length != 0)
			{
				currentImage = images[--currentImageIndex];
				requestAnimFrame(render);
			}
		}
		this.nextImage = function()
		{
			if(currentImageIndex < images.length - 1)
			{
				currentImage = images[++currentImageIndex];
				requestAnimFrame(render);
			}
		}
		
		this.save = function()
		{
			if(currentImage == null)
				return null;
			
			var width = currentImage.width, height = currentImage.height;
			
			var rttFramebuffer = gl.createFramebuffer();
			gl.bindFramebuffer(gl.FRAMEBUFFER, rttFramebuffer);
			rttFramebuffer.width = width;
			rttFramebuffer.height = height;

			var rttTexture = gl.createTexture();
			gl.bindTexture(gl.TEXTURE_2D, rttTexture);
			gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
			gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);

			gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, rttFramebuffer.width, rttFramebuffer.height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);

			var renderbuffer = gl.createRenderbuffer();
			gl.bindRenderbuffer(gl.RENDERBUFFER, renderbuffer);
			gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_COMPONENT16, rttFramebuffer.width, rttFramebuffer.height);

			gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, rttTexture, 0);
			gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, renderbuffer);

			gl.bindTexture(gl.TEXTURE_2D, null);
			gl.bindRenderbuffer(gl.RENDERBUFFER, null);
			gl.bindFramebuffer(gl.FRAMEBUFFER, null);
			
			
			gl.bindFramebuffer(gl.FRAMEBUFFER, rttFramebuffer);
			gl.viewportWidth = width;
			gl.viewportHeight = height;
			gl.viewport(0, 0, gl.viewportWidth, gl.viewportHeight);

			// Hide highlighted areas
			gl.useProgram(sdrFloat);
			gl.uniform1f(gl.getUniformLocation(sdrFloat, "highlightValue"), -1e20);
			
			this.render(true);
			
			// Restore highlighted areas
			if (highlightedValue !== -1e20)
			{
				gl.useProgram(sdrFloat);
				gl.uniform1f(gl.getUniformLocation(sdrFloat, "highlightValue"), highlightedValue);
			}

			var data = new Uint8Array(width * height * 4);
			gl.readPixels(0, 0, width, height, gl.RGBA, gl.UNSIGNED_BYTE, data);
			
			gl.bindFramebuffer(gl.FRAMEBUFFER, null);
			gl.deleteFramebuffer(rttFramebuffer);
			
			gl.viewportWidth = canvas.width = div.offsetWidth;
			gl.viewportHeight = canvas.height = div.offsetHeight;
			gl.viewport(0, 0, gl.viewportWidth, gl.viewportHeight);
			
			
			// Create a 2D canvas to store the result 
			var tempCanvas = document.createElement('canvas');
			tempCanvas.width = width;
			tempCanvas.height = height;
			
			// Copy the pixels to a 2D canvas
			var imageData = tempCanvas.getContext('2d').createImageData(width, height);
			imageData.data.set(data);
			tempCanvas.getContext('2d').putImageData(imageData, 0, 0);
			
			return {name: currentImage.name.substr(0, currentImage.name.lastIndexOf('.')) + ".png", dataURL: tempCanvas.toDataURL()};
		}
	}
	
	function render()
	{
		gl.clear(gl.COLOR_BUFFER_BIT);
		
		// Draw views
		views.forEach(function(view) {
			gl.viewport(gl.viewportWidth * view.x, gl.viewportHeight * (1.0 - view.y - view.height), gl.viewportWidth * view.width, gl.viewportHeight * view.height);
			view.render();
		});
		gl.viewport(0, 0, gl.viewportWidth, gl.viewportHeight);

		// Draw borders
		gl.useProgram(sdrLine);
		gl.uniform4f(sdrLine.colorUniform, 0.0, 0.0, 0.0, 1.0);
		meshLineQuad.bind(sdrLine, null);
		views.forEach(function(view) {
			var mattrans = mat4.create();
			mat4.identity(mattrans);
			mat4.translate(mattrans, mattrans, [2.0 * view.x - 1, 1 - 2.0 * (view.y + view.height), 0]);
			mat4.scale(mattrans, mattrans, [2.0 * view.width, 2.0 * view.height, 1.0]);
			gl.uniformMatrix4fv(sdrLine.matWorldViewProjUniform, false, mattrans);
			meshLineQuad.draw();
		});

		if(controlsAlpha > 0.0)
		{
			var sdr = null;
			for(var i = Math.max(0, currentImageIndex - 3); i <= Math.min(images.length - 1, currentImageIndex + 3); ++i)
				for(var l = 0; l < images[i].layers.length; ++l)
				{
					var layer = images[i].layers[l];
					if(layer.sdr !== sdr)
					{
						gl.useProgram(sdr = layer.sdr);
setColorMap(gl, sdr, sections, function(section) {return section.colorMap.texI;}); // Bugfix
					}
					
					var mattrans = mat4.create();
					mat4.identity(mattrans);
					mat4.scale(mattrans, mattrans, [2.0 / gl.viewportWidth, 2.0 / gl.viewportHeight, 1.0]);
					mat4.translate(mattrans, mattrans, [(THUMBNAIL_SIZE + 8) * (i - currentImageIndex), 8 + (THUMBNAIL_SIZE - gl.viewportHeight) / 2, 0]);
					mat4.scale(mattrans, mattrans, [THUMBNAIL_SIZE, THUMBNAIL_SIZE * layer.height / layer.width, 1.0]);
					mat4.translate(mattrans, mattrans, [-0.5, -0.5, 0.0]);
					gl.uniformMatrix4fv(sdr.matWorldViewProjUniform, false, mattrans);
					
					meshquad.bind(sdr, layer.tex);
					meshquad.draw();
				}
		}
	}

	this.zoomReset = function()
	{
		views.forEach(function(view) {
			view.zoomReset();
		});
	}
	this.zoomFit = function()
	{
		views.forEach(function(view) {
			view.zoomFit();
		});
	}
	this.zoomDefault = function()
	{
		views.forEach(function(view) {
			view.zoomDefault();
		});
	}
	
	var mdv = null, mdo = null;
	var tmd0 = vec3.create();
	this.onMouseDown = function(canvas, clientX, clientY, which)
	{
		if(which == 1)
		{
			/*if(clientY >= canvas.height - THUMBNAIL_SIZE + 8 && clientY < canvas.height - 8)
				for(var i = 0; i < images.length; ++i)
				{
					var image = images[i];
					if(true)
					{
						return;
					}
				}*/
			
			mdv = viewFromPoint(clientX, clientY, false, false);
			if (mdv !== null)
				mdv.onMouseDown(canvas, clientX, clientY, which);
		}
	}
	
	this.onMouseMove = function(canvas, clientX, clientY, pressedmousebuttons)
	{
		var mdo_new = viewFromPoint(clientX, clientY, false, false);
		/*if (mdo_new !== null && mdo_new !== mdo)
			mdo_new.onMouseEnter(canvas, clientX, clientY, pressedmousebuttons);*/

		if (mdv != null)
			mdv.onMouseMove(canvas, clientX, clientY, pressedmousebuttons);
		else
			views.forEach(function(view) {
				view.onMouseMove(canvas, clientX, clientY, pressedmousebuttons);
			});
		
		if (mdo !== null && mdo_new !== mdo)
			mdo.onMouseLeave(canvas, clientX, clientY, pressedmousebuttons);
		mdo = mdo_new;
		
		/*if(clientY > gl.viewportHeight - THUMBNAIL_SIZE - 8 && clientY < gl.viewportHeight - 8)
		{
			if(controlsAlpha == 0.0)
			{
				controlsAlpha = 1.0;
				requestAnimFrame(render);
			}
		}
		else
		{
			if(controlsAlpha == 1.0)
			{
				controlsAlpha = 0.0;
				requestAnimFrame(render);
			}
		}*/
		
		var controlSectionBounds = divImageControlSection.getBoundingClientRect();
		var canvasBounds = canvas.getBoundingClientRect();
		if(/*images.length !== 0 &&*/
		   canvasBounds.left + clientX >= controlSectionBounds.left &&
		   canvasBounds.top + clientY >= controlSectionBounds.top &&
		   canvasBounds.left + clientX < controlSectionBounds.right &&
		   canvasBounds.top + clientY < controlSectionBounds.bottom)
			fadeIn(divImageControlSection);
	}
	
	this.onMouseLeave = function(canvas, clientX, clientY, pressedmousebuttons)
	{
		if (mdo !== null)
			mdo.onMouseLeave(canvas, clientX, clientY, pressedmousebuttons);
		mdo = null;

		var controlSectionBounds = divImageControlSection.getBoundingClientRect();
		var canvasBounds = canvas.getBoundingClientRect();
		if(canvasBounds.left + clientX < controlSectionBounds.left ||
		   canvasBounds.top + clientY < controlSectionBounds.top ||
		   canvasBounds.left + clientX >= controlSectionBounds.right ||
		   canvasBounds.top + clientY >= controlSectionBounds.bottom)
			fadeOut(divImageControlSection);
	}
	
	this.onMouseUp = function(canvas, clientX, clientY, which)
	{
		if(which == 1)
			canvas.style.cursor = 'default';
	}
	
	this.onMouseWheel = function(canvas, clientX, clientY, deltaZ, which)
	{
		var view = viewFromPoint(clientX, clientY, false, false);
		if (view !== null)
			view.onMouseWheel(canvas, clientX, clientY, deltaZ, which);
	}
	
	this.onResize = function()
	{
		gl.viewportWidth = canvas.width = div.offsetWidth;
		gl.viewportHeight = canvas.height = div.offsetHeight;
		//gl.viewport(0, 0, gl.viewportWidth, gl.viewportHeight);

		views.forEach(function(view) {
			view.onResize();
		});
		requestAnimFrame(render);
	}
	this.onResize();
	
	var opacityTimer = null;
	function fadeIn(element)
	{
		if(element.style.visibility !== 'hidden')
			return;
		
		if(opacityTimer !== null)
			clearInterval(opacityTimer);
		var op = 0.2;  // initial opacity
		element.style.visibility = 'visible';
		opacityTimer = setInterval(function () {
			if(op >= 1)
				clearInterval(opacityTimer);
			element.style.opacity = op;
			element.style.filter = 'alpha(opacity=' + op * 100 + ")";
			op += op * 0.2;
		}, 5);
	}
	function fadeOut(element)
	{
		if(element.style.visibility === 'hidden')
			return;
		
		if(opacityTimer !== null)
			clearInterval(opacityTimer);
		var op = 1;  // initial opacity
		opacityTimer = setInterval(function () {
			if(op <= 0.2)
			{
				clearInterval(opacityTimer);
				element.style.visibility = 'hidden';
			}
			element.style.opacity = op;
			element.style.filter = 'alpha(opacity=' + op * 100 + ")";
			op -= op * 0.2;
		}, 5);
	}
	
	function ColorToValue(bytes, idx)
	{
		var valueI = (bytes[idx + 0] << 16) | (bytes[idx + 1] << 8) | (bytes[idx + 2]);
		if(valueI == 0 || bytes[idx + 3] == 0)
			return NaN;
		return (valueI - 0x1) / 0xfffffe; // 0 is reserved as "nothing"
	}
	this.createHistograms = function(size)
	{
		var histograms = [];
		views.forEach(function(view) {
			var histogram = view.createHistogram(size);
			if (histogram !== null)
				histograms.push(histogram);
		});
		return histograms;
	}
	
	this.loadImage = function(imageName, image, view, isLayer, isFloatImage)
	{
		if (view === null)
			view = views[0];
		
		var GL_MAX_TEXTURE_SIZE = gl.getParameter(gl.MAX_TEXTURE_SIZE);
		if(image.width > GL_MAX_TEXTURE_SIZE || image.height > GL_MAX_TEXTURE_SIZE)
			alert("Image can't be loaded because it is larger than the maximum texture size supported by your graphics card (" + GL_MAX_TEXTURE_SIZE + "x" + GL_MAX_TEXTURE_SIZE + ").");
		else
			view.loadImage(imageName, LoadTextureFromImage(gl, image), image.width, image.height, isLayer, isFloatImage);
	}
	this.loadImageFromByteArray = function(imageName, array, width, height, view, isLayer)
	{
		if (view === null)
			view = views[0];
		
		var GL_MAX_TEXTURE_SIZE = gl.getParameter(gl.MAX_TEXTURE_SIZE);
		if(width > GL_MAX_TEXTURE_SIZE || height > GL_MAX_TEXTURE_SIZE)
			alert("Image can't be loaded because it is larger than the maximum texture size supported by your graphics card (" + GL_MAX_TEXTURE_SIZE + "x" + GL_MAX_TEXTURE_SIZE + ").");
		else
			view.loadImage(imageName, LoadTextureFromByteArray(gl, array, width, height), width, height, isLayer, true);
	}
	this.loadImageFromFloatArray = function(imageName, array, width, height, view, isLayer)
	{
		if (view === null)
			view = views[0];
		
		var GL_MAX_TEXTURE_SIZE = gl.getParameter(gl.MAX_TEXTURE_SIZE);
		if(width > GL_MAX_TEXTURE_SIZE || height > GL_MAX_TEXTURE_SIZE)
		{
			alert("Image can't be loaded because it is larger than the maximum texture size supported by your graphics card (" + GL_MAX_TEXTURE_SIZE + "x" + GL_MAX_TEXTURE_SIZE + ").");
			return;
		}
		var tex = LoadTextureFromFloatArray(gl, array, width, height);
		if (tex === null)
			return;
		view.loadImage(imageName, tex, width, height, isLayer, true);
	}
	
	this.prevImage = function()
	{
		views.forEach(function(view) {
			view.prevImage();
		});
	}
	this.nextImage = function()
	{
		views.forEach(function(view) {
			view.nextImage();
		});
	}
	
	this.save = function()
	{
		var images = [];
		views.forEach(function(view) {
			var image = view.save();
			if (image !== null)
				images.push(image);
		});
		return images;
	}

	var highlightedValue;
	gl.useProgram(sdrFloat);
	gl.uniform1f(gl.getUniformLocation(sdrFloat, "highlightValue"), highlightedValue = -1e20);
	this.highlightValue = function(value)
	{
		if (value === null || value < 0.0 || value >= 1.0)
			value = -1e20;
		
		if (value != highlightedValue)
		{
			gl.useProgram(sdrFloat);
			gl.uniform1f(gl.getUniformLocation(sdrFloat, "highlightValue"), highlightedValue = value);
			requestAnimFrame(render);
		}
	}
	
var sections; // Bugfix
	this.setColorMap = function(_sections)
	{
sections = _sections; // Bugfix
		setColorMap(gl, sdrFloat, sections, function(section) {return section.colorMap.texI;});
		requestAnimFrame(render);
	}
	
	function Image(tex, width, height, isFloat)
	{
		this.tex = tex;
		this.sdr = isFloat ? sdrFloat : sdrTextured;
		this.width = width;
		this.height = height;
	}
}