const axios = require('axios')
const xmlParser = require('xml2json');
const csvwriter = require('csv-writer');
const createCsvWriter = csvwriter.createObjectCsvWriter
const csvWriter = createCsvWriter({
  
  // Output csv file name is geek_data
  path: 'geek_data2.csv',
  header: [
  
    // Title of the columns (column_names)
	{id: 'fund' , title: 'Fund'},
	{id: 'fundLei', title: 'Fund Lei'},
    {id: 'name', title: 'Company'},
    {id: 'lei', title: 'Company LEI'},
	{id: 'balance' , title: 'Shares Held'},
	{id: 'valUSD' , title: 'Shares Value'},
	{id: 'isLoanByFund' , title: 'Value on Loan'},	
	{id: 'loanedShares' , title: 'Shares Loaned'},	
	{id: 'pctValpc', title: 'Weight'},
	{id: 'ending', title: 'Reporing Date'},	
	{id: 'gmeborr', title: 'Borrower'},
	{id: 'payoffProfile', title: 'Long/Short'},
	{id: 'fillingURL', title: 'Filling URL'},	
	{id: 'fileType', title: 'Filling Type'},
	{id: 'borrowers', title: 'Borrowers'},
		
		
  ]
});

function delay(t) {
    return new Promise(resolve => setTimeout(resolve, t));
}

async function getResults(requests) {

    const results = [];
    const strings = ['a', 'b', 'c'];
    for (let  str  of  requests) {
        await delay(3000);
		console.log("getting ", str)
        let data = await axios.get(str);
        results.push(data);
    }
    return results;
}

const companyLei = "549300505KLOET039L77"; // Add your company lei. 

//const companyLei = "549300ZO77UNR6NRBR11"
let runner = function(page) {
	let reqParams = {
		"q":companyLei, // add your search term
		"dateRange":"all",
		"startdt":"2021-11-01", // Fill in start date for search
		"enddt":"2021-12-01" // Fill in End Date for search
	}
	if(page) {
		reqParams.page = page;
		reqParams.from = page + "00";
	}
	axios
	  .post('https://efts.sec.gov/LATEST/search-index', reqParams )
	  .then(res => {

		let requests = [];
		let endingPeriods = [];
		let filingURLs = [];
		let fileTypes = [];
		res.data.hits.hits.forEach(element => {
		  if(element._source.file_type === "NPORT-P" || element._source.file_type === "NPORT-P/A") { 
			  let param1 = element._source.ciks[0];
			  let param2 = element._source.adsh.split("-").join("");
			  let param3 = element._id.split(":")[1]
			  endingPeriods.push(element._source.period_ending);
			  fileTypes.push(element._source.file_type)
			  filingURLs.push(`https://www.sec.gov/Archives/edgar/data/${param1}/${param2}/xslFormNPORT-P_X01/${param3}`);
			  requests.push(`https://www.sec.gov/Archives/edgar/data/${param1}/${param2}/${param3}`)
		  }

		});
		console.log("NPORT-Ps", requests.length);
		
		(async () => {
		  //try {
			  
			const responses = await getResults(requests);
			let companyArray = []
				  responses.forEach((res, index) => {
					 // console.log(JSON.parse(xmlParser.toJson(res.data)).edgarSubmission)
					//if(JSON.parse(xmlParser.toJson(res.data)).edgarSubmission) {
						
						let myjs = JSON.parse(xmlParser.toJson(res.data)).edgarSubmission.formData.invstOrSecs.invstOrSec
						let fund = JSON.parse(xmlParser.toJson(res.data)).edgarSubmission.formData.genInfo.regName;
						let fundLei = JSON.parse(xmlParser.toJson(res.data)).edgarSubmission.formData.genInfo.seriesLei
						let ending = endingPeriods[index];
						let fileType = fileTypes[index];
						let filingURL = filingURLs[index];
						//console.log(JSON.parse(xmlParser.toJson(res.data)).edgarSubmission.formData.fundInfo.borrowers)
						let borrowers = []
						if(JSON.parse(xmlParser.toJson(res.data)).edgarSubmission.formData.fundInfo && JSON.parse(xmlParser.toJson(res.data)).edgarSubmission.formData.fundInfo.borrowers) {
							borrowers = JSON.parse(xmlParser.toJson(res.data)).edgarSubmission.formData.fundInfo.borrowers.borrower;
							//console.log(borrowers);
						};
						let borrowlist = [];
						//console.log(borrowers)
						if(borrowers && Array.isArray(borrowers)) {
							borrowers.forEach(borr => {
								borrowlist.push(borr.name);
							})
						} else {
							borrowlist.push(borrowers.name);
						}

						myjs.forEach((comp, i) => {
							
							if(comp.lei === companyLei && comp.units === "NS") {
								//console.log(comp)
								comp.isLoanByFund = comp.securityLending.isLoanByFund ? comp.securityLending.isLoanByFund : comp.securityLending.loanByFundCondition.loanVal;
								comp.fund = fund;
								comp.index = i;
								
								comp.fundLei = fundLei;
								let shVal = Number(comp.valUSD) / Number(comp.balance);
								if(comp.isLoanByFund !== "N") {
									comp.loanedShares = Number(comp.isLoanByFund) / shVal;
									if(borrowers && Array.isArray(borrowers)) {
										borrowers.forEach(b => { 
											if(comp.isLoanByFund === b.aggrVal) { comp.gmeborr = b.name; }
										})
									} else {
										if(comp.isLoanByFund === borrowers.aggrVal) { comp.gmeborr = borrowers.name }
									}

								}
								comp.pctValpc = comp.pctVal + "%";
								comp.ending = ending;
								comp.fillingURL = filingURL;
								comp.fileType = fileType;
								//console.log(comp)
								comp.borrowers = borrowlist.join("|");

								companyArray.push(comp)
							} else if(comp.lei === companyLei && comp.units !== "NS") {
								
								//console.log(comp)
							}
						})
					//} else {
					//	JSON.parse(xmlParser.toJson(res.data))
					//}
				  })
				  console.log("matching nports", companyArray.length)
				  csvWriter.writeRecords(companyArray)
					.then(()=> {
						console.log("data saved")
							if(!page) {
								page = 0;
							}
							if(res.data.hits.hits.length > 0) {
								page++;
								console.log("page", page)
								runner(page)
							} else {
								console.log("finished")
							}
						  
					});
		  //} catch (error) {
			//console.log(error.response.body);
		  //}
		})();	

		

	  })
	  .catch(error => {
		console.error(error)
	  })
}
runner()