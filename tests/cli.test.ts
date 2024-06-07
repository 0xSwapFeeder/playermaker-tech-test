import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

// Utility function to run the CLI command
const runCLI = (args: string): string => {
    try {
        return execSync(`ts-node index.ts ${args}`, { encoding: 'utf8' });
    } catch (error: any) {
        return error.stdout.toString() || error.stderr.toString() || error.message;
    }
};

describe('Badge validation', () => {
    const testImagesDir = path.join(__dirname);

    // Spy on process.stderr.write to capture stderr output
    let stderrWriteSpy: jest.SpyInstance;
    beforeEach(() => {
        stderrWriteSpy = jest.spyOn(process.stderr, 'write').mockImplementation(() => true);
    });

    // Restore the original implementation of process.stderr.write
    afterEach(() => {
        stderrWriteSpy.mockRestore();
    });

    it('should validate an image that conveys a happy feeling and is circular', () => {
        const output = runCLI(`--check ${path.join(testImagesDir, 'test_true.png')}`);
        expect(output).toContain('Image is valid, circular, and conveys a happy feeling.');
    });

    it('should fail validation if the image does not convey a happy feeling', () => {
        runCLI(`--check ${path.join(testImagesDir, 'test_false_colors.png')}`);
        expect(stderrWriteSpy).toHaveBeenCalledWith(expect.stringContaining(('Validation failed: Image does not convey a happy feeling.')));
    });

    it('should fail validation if the image dimensions exceed 512x512 pixels', () => {
        runCLI(`--check ${path.join(testImagesDir, 'test_false_size.png')}`);
        expect(stderrWriteSpy).toHaveBeenCalledWith(expect.stringContaining(('Validation failed: Image dimensions exceed 512x512 pixels.')));
    });

    it('should fail vaildation if image is non-circular', () => {
        runCLI(`--check ${path.join(testImagesDir, 'test_false_square.png')}`);
        expect(stderrWriteSpy).toHaveBeenCalledWith(expect.stringContaining(('Validation failed: Image has non-transparent pixels outside the circle.')));
    });

    it('should fail validation if the image format is not PNG', () => {
        runCLI(`--check ${path.join(testImagesDir, 'test_wrong_format.jpeg')}`);
        expect(stderrWriteSpy).toHaveBeenCalledWith(expect.stringContaining(('Validation failed: Image format is not PNG.')));
    });

});

describe('Badge formating', () => {
    const testImagesDir = path.join(__dirname);
    const outputFilePath = path.join(testImagesDir,"..", 'output.png');

    afterEach(() => {
        // Clean up the output file after each test
        if (fs.existsSync(outputFilePath)) {
            fs.unlinkSync(outputFilePath);
        }
    });

    it('should succeed applying circle mask', () => {
        const output = runCLI(`${path.join(testImagesDir, 'test_false_square.png')}`);
        expect(output).toContain('Image is now circular in the output.png file!');
        expect(fs.existsSync(outputFilePath)).toBe(true);
    });

    it('should succeed converting to png and applying circle mask', () => {
        const output = runCLI(`${path.join(testImagesDir, 'test_wrong_format.jpeg')}`);
        expect(output).toContain('Image is now circular in the output.png file!');
        expect(fs.existsSync(outputFilePath)).toBe(true);
    });

});