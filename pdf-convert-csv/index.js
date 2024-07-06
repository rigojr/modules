/**
 * PDF convert to csv
 */

import fs from 'fs';
import { PdfReader } from "pdfreader";

const cut = process.argv[2]; // 202204
const breakers = process.argv.slice(3); // ABR/

if (cut === undefined || breakers.length < 1) {
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

function processText(text) {
  if (typeof text !== 'string') {
    throw new Error('text is not string')
  }

  const isStartOfLine = breakers.some((brk) => text.includes(brk));
  const isEndOfPrintedContent = text.includes('/2023');
  const isEndOfLine = text.includes('$');

  if (isStartOfLine && !isEndOfPrintedContent) {
    canBeSave = true;
  }

  if (canBeSave) {
    if (content[linePosition] === undefined) {
      content.push([text]);
    } else {
      content[linePosition].push(text);
    }
  }

  if (canBeSave && isEndOfLine) {
    linePosition ++;

    canBeSave = false;
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
  else if (item !== undefined && item.text !== undefined) processText(item.text);
  else transformText();
});