var PI = 3.141592654

function makeArray(d1, d2, d3) {
	var arr = [];
	if(d3)
	{
		for(i = 0; i < d1; i++)
		{
			arr.push([]);
			for(j = 0; j < d2; j++)
				arr[i].push(new Array(d3));
		}
	}
	else
	{
		for(i = 0; i < d1; i++)
			arr.push(new Array(d2));
	}
	return arr;
}

function deepCopyArray(array, dimensions)
{
	var newarray = array.slice();
	if(--dimensions)
		for(var i = 0; i < array.length; i++)
			newarray[i] = deepCopyArray(array[i], dimensions);
	return newarray;
}

function isFunction(x) {
	return Object.prototype.toString.call(x) == "[object Function]";
}
function isArray(x) {
	return Object.prototype.toString.call(x) == "[object Array]";
}

function vecLerp(vout, v0, v1, alpha)
{
	for(var i = 0; i < v0.length; i++)
		vout[i] = v0[i] * (1.0 - alpha) + v1[i] * alpha;
}