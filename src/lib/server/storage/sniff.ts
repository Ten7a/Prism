// Magic-byte sniffing for the upload mime allowlist.
// Returns true when the first bytes match the claimed mime.
export function sniffMatches(bytes: Uint8Array, mime: string): boolean {
	if (bytes.length < 12) return false;
	switch (mime) {
		case 'image/png':
			return (
				bytes[0] === 0x89 &&
				bytes[1] === 0x50 &&
				bytes[2] === 0x4e &&
				bytes[3] === 0x47 &&
				bytes[4] === 0x0d &&
				bytes[5] === 0x0a &&
				bytes[6] === 0x1a &&
				bytes[7] === 0x0a
			);
		case 'image/jpeg':
			return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
		case 'image/webp':
			return (
				bytes[0] === 0x52 && // R
				bytes[1] === 0x49 && // I
				bytes[2] === 0x46 && // F
				bytes[3] === 0x46 && // F
				bytes[8] === 0x57 && // W
				bytes[9] === 0x45 && // E
				bytes[10] === 0x42 && // B
				bytes[11] === 0x50 // P
			);
		default:
			return false;
	}
}
