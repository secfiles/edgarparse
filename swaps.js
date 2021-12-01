const axios = require('axios')
const xmlParser = require('xml2json');
const csvwriter = require('csv-writer');
const createCsvWriter = csvwriter.createObjectCsvWriter
const csvWriter = createCsvWriter({
  
  // Output csv file name is geek_data
  path: 'swaps.csv',
  header: [
  
    // Title of the columns (column_names)
	{id: 'counterpartyName' , title: 'counterpartyName'},
	{id: 'counterpartyLei', title: 'counterpartyLei'},
    {id: 'othIndName', title: 'othIndName'},
	{id: 'cusip', title: 'cusip'},
    {id: 'othIndNotAmt', title: 'othIndNotAmt'},
	{id: 'othIndValue' , title: 'othIndValue'},
	{id: 'othIndCurCd' , title: 'othIndCurCd'},
	{id: 'descRefInstrmnt', title: 'descRefInstrmnt'},
		
		
  ]
});
const companyLei = "gamestop"; // Add your company lei. 

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
//const companyLei = "549300ZO77UNR6NRBR11"
let runner = function(page) {
	let reqParams = {
		"q":companyLei, // add your search term
		"dateRange":"all",
		"startdt":"2021-11-20", // Fill in start date for search
		"enddt":"2021-11-24" // Fill in End Date for search
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
						/*let borrowers = []
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
						}*/
						let obj = {};
						myjs.forEach((comp, i) => {
							if(comp.derivativeInfo && comp.derivativeInfo.swapDeriv) {
								
								for (k in comp.derivativeInfo.swapDeriv.counterparties) {
									obj[k] = comp.derivativeInfo.swapDeriv.counterparties[k]
								}
								//obj.counterparties = comp.derivativeInfo.swapDeriv.counterparties;
								if(comp.derivativeInfo.swapDeriv.descRefInstrmnt && comp.derivativeInfo.swapDeriv.descRefInstrmnt.indexBasketInfo) {
									obj.descRefInstrmnt = comp.derivativeInfo.swapDeriv.descRefInstrmnt.indexBasketInfo.narrativeDesc
									let comps = comp.derivativeInfo.swapDeriv.descRefInstrmnt.indexBasketInfo.components;
									//obj.components = comps;
									//console.log(comps)
									if(comps && comps.component && Array.isArray(comps.component)) {
										comps.component.forEach(c => {
											for (key in obj) {
													c[key] = obj[key]
											}
											//console.log(c.identifiers.cusip.value)
											if(c.identifiers.cusip) {
												//console.log(c);

												obj.cusip = c.identifiers.cusip.value
												//companyArray.push(obj)
												//console.log(obj)
											} else if(c.identifiers.isin) {

												obj.cusip = c.identifiers.isin.value
												
											}
											companyArray.push(c)
											
										})
									}
									
									
								}
								
								
							}
							/*if(comp.lei === companyLei && comp.units === "NS") {
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
							}*/
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