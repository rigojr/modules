/**
 * PDF convert to csv
 */

import fs from 'fs';
import { PdfReader } from "pdfreader";

const cut = process.argv[2]; // 202204
const startLinePattern = /^[A-Z]{3}\/\d{2}$/;

if (cut === undefined) {
  console.log('Some arguments are not properly defined.');

  process.exit(1);
}

const spendingFileName = `${cut}-spending.csv`
const missingDescriptionsFileName = `${cut}-missing-descriptions.csv`
const pdfFileName = `${cut}.pdf`

const content = [];
const missingDescriptions = [];

let linePosition = 0;
let canBeSave = false;

function processLine(line) {
  if (typeof line !== 'string') {
    throw new Error('line is not string')
  }

  const isStartOfLine = startLinePattern.test(line);
  const isEndOfLine = line.includes('$');

  if (isStartOfLine) {
    canBeSave = true;
  }

  if (canBeSave) {
    doProcessLine(line);
  }

  if (canBeSave && isEndOfLine) {
    linePosition ++;

    canBeSave = false;
  }
}

function doProcessLine(line) {
  if (content[linePosition] === undefined) {
    content.push([line]);
  } else {
    content[linePosition].push(line);
  }
}

function getAmount(rawLine) {
  const rawAmount = rawLine[rawLine.length - 1]
      .replace('$','')
      .replace(',', '');

  return parseFloat(rawAmount);
}

function getCategory(categories, spendingCategories, description) {
  if (!spendingCategories.some((value) => description.includes(value))) {
    missingDescriptions.push(`"${description}",`);

    return 'no category';
  } else {
    const spendingCategoryKeys = Object.keys(categories.spending);
    const categoryFinder = spendingCategories.find((value) => description.includes(value));
    const category = spendingCategoryKeys.find((value) => categories.spending[value].includes(categoryFinder))

    return category ?? 'no category';
  }
}

function transformText() {
  const categories = JSON.parse(fs.readFileSync('assets/preferences.json')).categories;
  const spendingCategories =  Object.values(categories.spending).flat();
  const transformContent = [];

  content.forEach((rawLine) => {
    const rawAmount = rawLine[rawLine.length - 1]

    if (rawAmount.includes('-')) {
      return;
    }

    const date = rawLine[0];
    const reference = rawLine[1];
    const description = [...rawLine.slice(2, rawLine.length - 1)].join(' ');
    const amount = getAmount(rawLine);
    const category = getCategory(categories, spendingCategories, description);

    transformContent.push(`${cut}{${date}{${reference}{${category}{${description}{${amount}\n`);
  });

  fs.writeFileSync(`assets/${spendingFileName}`, transformContent.join(''));
  fs.writeFileSync(`assets/${missingDescriptionsFileName}`, missingDescriptions.flat().join('\n'));
}

new PdfReader().parseFileItems(`assets/${pdfFileName}`, (err, item) => {
  if (err) console.error('error:', err);
  else if (item !== undefined && item.text !== undefined) processLine(item.text);
  else transformText();
});