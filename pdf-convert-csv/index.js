/**
 * PDF convert to csv
 */

import fs from 'fs';
import { PdfReader } from "pdfreader";
import { promisify } from 'util';

const path = process.argv[2];
const startLinePattern = /^[A-Z]{3}\/\d{2}$/;

if (path === undefined) {
  console.log('Path is not properly defined.');

  process.exit(1);
}

const transformContent = [];
const missingDescriptions = [];

let content = [];
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

function transformText(cut) {
  const categories = JSON.parse(fs.readFileSync('assets/preferences.json')).categories;
  const spendingCategories =  Object.values(categories.spending).flat();

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
}

function parseFile(file) {
  return new Promise((resolve, rejects) => {
    new PdfReader().parseFileItems(`./assets/pdf/${file}`, (err, item) => {
      if (err) rejects(err);
      else if (!item) {
        const cut = file.split('.')[0];
        const spendingFileName = `${cut}-spending.csv`;

        transformText(cut, spendingFileName);

        resolve();
      }
      else if (item.text) processLine(item.text);
    });
  })
}

async function main() {
  const promisifyReaddir = promisify(fs.readdir);
  const files = await promisifyReaddir(path);

  for await(const file of files) {
    console.log(`processing ${file}.`);
    try {
      linePosition = 0;
      content = [];
      canBeSave = false;

      await parseFile(file);

      console.log(`done ${file}.`);
    } catch (error) {
      console.error('error:', err);
    }
  }

  fs.writeFileSync(`assets/csv/missing-descriptions.csv`, missingDescriptions.flat().join('\n'));
  fs.writeFileSync(`assets/csv/spending-all.csv`, transformContent.join(''));

}

main()
  .catch(() => {});