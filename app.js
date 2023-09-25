const axios = require('axios');
const cheerio = require('cheerio');
const XLSX = require('xlsx');
require('dotenv').config();


// Function to fetch the content of a web page
const getPageContent = async (url) => {
    try {
        const response = await axios.get(url);
        return response.data;
    } catch (error) {
        throw new Error(`Error fetching the page: ${error}`);
    }
};


// Function to extract the URL from an article
const extractUrl = (article) => {
    const $ = cheerio.load(article);
    const titleElement = $(article).find('section div h1 a');
    return titleElement.attr('href');
};


// Function to extract the data-id attribute from an article
const extractDataId = (article) => {
    const $ = cheerio.load(article);
    return $(article).attr('data-id');
};


// Function to extract the mileage information from an article
const extractDataMileage = (article) => {
    const $ = cheerio.load(article);
    const mileageElement = $('dd[data-parameter="mileage"]');
    return mileageElement.text().trim();
};


// Function to extract the engine power information from an article
const extractDataPower = (article) => {
    const $ = cheerio.load(article);
    const powerElement = $('dd[data-parameter="engine_power"]');
    return powerElement.text().trim();
};



// Function to extract the production year information from an article
const extractDataYear = (article) => {
    const $ = cheerio.load(article);
    const yearElement = $('dd[data-parameter="year"]');
    return yearElement.text().trim();
};



// Function to extract the price text from an article
const extractPriceText = (article) => {
    const $ = cheerio.load(article);
    let priceVal = '';

    const commonElement = $('article').eq(0)
        .find('section').eq(0);

    const simplePriceText = commonElement
        .find('div').eq(3)
        .find('div')
        .find('h3');

    if (simplePriceText.text().length > 0) {
        priceVal = simplePriceText.text().trim() + ' PLN';
    } else {
        const complexElement = commonElement
            .find('div').eq(4)
            .find('div').eq(2)
            .find('div')
            .find('h3');

        if (complexElement.text().length > 0) {
            priceVal = complexElement.text().length > 0 ? complexElement.text() + ' PLN' : '';
        } else {
            const compoundElement = commonElement.find('div').eq(5).find('div').eq(2).find('div')
                .find('h3');

            priceVal = compoundElement.text().length > 0 ? compoundElement.text() + ' PLN' : '';

            if (compoundElement.html() == null) {
                const moreCompoundElement = commonElement.find('div').eq(6).find('div').eq(2).find('div')
                    .find('h3');
                priceVal = moreCompoundElement.text().length > 0 ? moreCompoundElement.text() + ' PLN' : '';
            }
        }
    }

    return priceVal;
};



// Function to check if additional elements are present
const extractAddsElement = (article) => {
    let addFlag = false;
    const $ = cheerio.load(article);
    const addElement = $('article').eq(0).find('article').find('ol').find('a');

    if (addElement.text().length > 0) {
        addFlag = true;
    }

    return addFlag;
};



// Function to extract main content from the HTML
const extractMainContent = (html) => {
    const $ = cheerio.load(html);
    const data = [];

    const mainElement = $('[data-testid="search-results"]');
    mainElement.find('div article[data-media-size]').each((index, article) => {
        const titleElement = $(article).find('section div h1 a');
        const title = titleElement.text().trim();
        const url = extractUrl(article);
        const dataId = extractDataId(article);
        const dataMileage = extractDataMileage(article);
        const dataPower = extractDataPower(article);
        const dataYear = extractDataYear(article);
        const dataPrice = extractPriceText(article);

        const dataAddFlag = extractAddsElement(article);

        data.push({title, dataId, url, dataMileage, dataPower, dataYear, dataPrice, dataAddFlag});
    });

    return data;
};



// Function to extract Google adds from the target HTML
const extractGoogleAds = (html, pageNumber) => {
    const $ = cheerio.load(html);
    const adContainers = $('div[id*="ads"], div[class*="ads"], div[class*="ad"], div[class*="ad-container"], iframe[src*="googleads"]');
    const ads = [];

    if (adContainers.length > 0) {
        adContainers.each((index, element) => {
            ads.push({
                page: pageNumber,
                position: index + 1,
                content: $(element).html()
            });
        });
    }

    return ads;
};



// Function to write data to an Excel file
const writeToExcel = (data, filePath) => {
    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.json_to_sheet(data);

    XLSX.utils.book_append_sheet(workbook, worksheet, 'Data');
    XLSX.writeFile(workbook, filePath);
};



// Function to write adds data to an Excel file
const writeToAdsExcel = (ads, filePath) => {
    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.json_to_sheet(ads);

    XLSX.utils.book_append_sheet(workbook, worksheet, 'Ads');
    XLSX.writeFile(workbook, filePath);
};



// Function to get data from the next page
const getNextPageData = async (baseUrl, pageNumber) => {
    const url = `${baseUrl}&page=${pageNumber}`;
    const html = await getPageContent(url);
    const mainContent = extractMainContent(html);
    const ads = extractGoogleAds(html, pageNumber);

    return {mainContent, ads};
};




// Main function to execute the scraping process
const main = async () => {

    const baseUrl = process.env.URL;
    const mainData = [];
    const adsData = [];
    const pageNumberStart = process.env.PageStart;
    const pageNumberEnd = process.env.PageEnd;

    for (let pageNumber = pageNumberStart; pageNumber <= pageNumberEnd; pageNumber++) {
        const {mainContent, ads} = await getNextPageData(baseUrl, pageNumber);
        mainData.push(...mainContent);
        adsData.push(...ads);

        if (ads.length > 0) {
            //console.log(`Ads found on page ${pageNumber}:`, ads);
        } else {
            console.log(`No ads found on page ${pageNumber}.`);
        }
    }

    if (mainData.length > 0) {
        const xlsxFile = process.env.XLSX_Main_File_Title;
        writeToExcel(mainData, xlsxFile);
        console.log(`Main data written to ${xlsxFile}`);
    } else {
        console.log('No main data found.');
    }

    if (adsData.length > 0) {
        const addXlsxFile = process.env.XLSX_Adds_File_Title;

        writeToAdsExcel(adsData, addXlsxFile);
        console.log(`Ads data written to ${addXlsxFile}`);
    } else {
        console.log('No ads data found.');
    }
};



// Call the main function
main().catch(error => console.error(error));
