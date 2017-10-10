function BinaryReader(bytes)
{
	var bytes = bytes;
	var index = 0;

	this.peek = function()
	{
		return index < bytes.length ? bytes[index] : -1;
	}

	this.readByte = function()
	{
		return bytes[index++];
	}
	
	this.readUInt32 = function()
	{
		var num = 0;
		for(var end = index + 4; index < end; ++index)
			num = (num << 8) + bytes[index];
		return num >>> 0;
	}

	this.readBytes = function(len)
	{
		index += len;
		return bytes.slice(index - len, index);
	}

	this.readString = function(len)
	{
		var str = "";
		for(var end = index + len; index < end; ++index)
			str += String.fromCharCode(bytes[index]);
		return str;
	}
}

function PngChunk(br)
{
	var length = br.readUInt32();
	var type = br.readString(4);
	var data = br.readBytes(length);
	var crc = br.readUInt32();

	this.getType = function()
	{
		return type;
	}

	this.toString = function()
	{
		return "PngChunk {type: " + type + ", length: " + length + ", crc: " + crc + "}";
	}

	this.getTextChunkKeyAndValue = function()
	{
		if(type !== "tEXt")
			return null;
		
		var i = 0;
		
		// Read null-terminated key
		var key = "";
		while(data[i] != 0)
			key += String.fromCharCode(data[i++]);

		++i; // Skip '\0'
		
		// Read end-of-data-terminated value
		var val = "";
		while(i < length)
			val += String.fromCharCode(data[i++]);
		
		return {key: key, value: val};
	}
}

function readPngChunks(bytes)
{
	var PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0D, 0x0A, 0x1A, 0x0A];

	var br = new BinaryReader(bytes);
	
	// Check signature
	for(var i = 0; i < 8; ++i)
		if(br.readByte() !== PNG_SIGNATURE[i])
		{
			console.log('PNG signature mismatch');
			return null;
		}

	// Read chunks
	var chunks = [];
	while(br.peek() !== -1)
		chunks.push(new PngChunk(br));
	
	return chunks;
}

function printPngChunks(chunks)
{
	chunks.forEach(function(chunk) {
		console.log(chunk.toString());
	});
}

function getPngMetaData(chunks)
{
	var meta = [];
	chunks.forEach(function(chunk) {
		if(chunk.getType() === "tEXt")
		{
			var keyAndValue = chunk.getTextChunkKeyAndValue();
			meta[keyAndValue.key] = keyAndValue.value;
		}
	});
	return meta;
}