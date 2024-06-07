## Simple Badge Validator and Formater

### About
For starters, the project is unit tested and continuously integrated, check the github actions workflows!

This CLI program either formats or validate the given file:

#### Validation:
- Checks if the image is of size 512x512 pixels or less
- Checks if the image is circular (only using non-transparent colors inside its circle)
- Checks if the image is of format .png
- Checks if the image is conveying a "happy" feeling with its colors (using simple dominant color rgb values checking)

#### Formater:
- Changes the format of the file (whatever its original file format) to .png
- Rounds the image using a mask and applying full transparancy outside the mask
- Outputs the new file as "output.png"


### Installation
Simply run the following command at root level:
```npm install ```

### Usage
```npm start -- <filepath> [--check]```

The ```--check``` option is meant to not modifiy the input file in any case and just perform validation tests on the file

Without it the CLI simply applies a circular mask on the image to make it round and creates a new file "output.png".
(Yes it converts the image to PNG whatever the file format)
