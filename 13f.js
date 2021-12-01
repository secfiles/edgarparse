const axios = require('axios')
const xmlParser = require('xml2json');
const csvwriter = require('csv-writer');
const createCsvWriter = csvwriter.createObjectCsvWriter
const fs = require('fs'); 
const csvWriter = createCsvWriter({
 
  // Output csv file name is geek_data
  path: '13fsdetails.csv',
  header: [
  
    // Title of the columns (column_names)
	{id: 'filler' , title: 'filler'},
	{id: 'fillerCusip' , title: 'fillerCusip'},
	{id: 'reportingForm' , title: 'reportingFor'},
	{id: 'fillingDate' , title: 'fillingDate'},
	{id: 'nameOfIssuer' , title: 'nameOfIssuer'},
	{id: 'titleOfClass', title: 'titleOfClass'},
    {id: 'cusip', title: 'cusip'},
	{id: 'value', title: 'value x 1000'},
	{id: 'sshPrnamt', title: 'sshPrnamt'},
	{id: 'sshPrnamtType', title: 'sshPrnamtType'},
	{id: 'valsh', title: 'value/share'},
    {id: 'putCall', title: 'putCall'},
	{id: 'investmentDiscretion' , title: 'investmentDiscretion'},
	{id: 'otherManager' , title: 'otherManager'},
	{id: 'votingAuthoritySole', title: 'votingAuthoritySole'},
	{id: 'votingAuthorityShared', title: 'votingAuthorityShared'},
	{id: 'votingAuthorityNone', title: 'votingAuthorityNone'},
	{id: 'fillingURL', title: 'fillingURL'},
	{id: 'fillingXML', title: 'fillingXML'},

  ]
});
const companyLei = "36467W109"; // Add your company lei. 

function delay(t) {
    return new Promise(resolve => setTimeout(resolve, t));
}

async function getResults(requests) {

    const results = [];
    for (const [i, str] of requests.entries()){
        await delay(3000);
		console.log("getting ", i, str.url)
        let data = await axios.get(str.url);
        results.push(data);
		// here I should start processing that URL
		var regex = /<a[^>]*href=["']([^"']*.xml)["']/gi;
		while(match=regex.exec(data.data)){
			if(!(match[1].includes("primary_doc.xml") || match[1].includes("xslForm13F_X01"))) {
				//console.log("https://www.sec.gov" + match[1]);
				str.xmlURL = "https://www.sec.gov" + match[1];
				
			}					
		}		
		//should go in the while, but looks like the regex is sometimes failing so I want to see why
		getXML(str);
		
    }
    return results;
}
async function getXML(str) {
		await delay(3000);
		console.log("getting ", str.xmlURL)
		let data = await axios.get(str.xmlURL);
        //results.push(data);
		var myjs = JSON.parse(xmlParser.toJson(data.data))
		//console.log(myjs)
		process(myjs, str)
}

function process(data, original) {
	let reg = /informationTable/;
	let reg2 = /infoTable/;

	
	var string = JSON.stringify(data);
	//console.log()
	var parsed = JSON.parse(string.replace(/ns1:/gi, "").replace(/ns4:/gi, "").replace(/n1:/gi, ""))
	//console.log(parsed.infoTable.forEac);
	var companyArray = [];
	parsed.informationTable.infoTable.forEach(tab => {
		if(tab.cusip.toUpperCase() === companyLei) {
			//console.log(tab)
			tab.sshPrnamt = tab.shrsOrPrnAmt.sshPrnamt;
			tab.sshPrnamtType = tab.shrsOrPrnAmt.sshPrnamtType;
			var number = (tab.value * 1000)/tab.sshPrnamt ;
			
			tab.valsh = number.toFixed(2)
			tab.votingAuthoritySole = tab.votingAuthority.Sole;
			tab.votingAuthorityShared = tab.votingAuthority.Shared;
			tab.votingAuthorityNone = tab.votingAuthority.None;
			tab.filler = original.name;
			tab.fillerCusip = original.cusip;
			tab.reportingForm = original.reportingFor;
			tab.fillingDate = original.fillingDate;
			tab.fillingURL = original.url;
			tab.fillingXML = original.xmlURL
			//console.log(tab)
			companyArray.push(tab)
		}
	})
	csvWriter.writeRecords(companyArray)
}

let runner = function(page) {
	let reqParams = {
		"q":companyLei, // add your search term
		"dateRange":"all",
		"startdt":"2014-01-01", // Fill in start date for search
		"enddt":"2017-09-29", // Fill in End Date for search
		"category":"form-cat1"
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
		let fillingDates = [];
		//let periodDates = [];
		let fillers = [];
		let cusips = [];
		
		let completeData = [];
		res.data.hits.hits.forEach(element => {
		  if(element._source.form === "13F-HR") { 
			  let param1 = element._source.ciks[0];
			  let param2 = element._source.adsh.split("-").join("");
			  let param3 = element._id.split(":")[0]
			  endingPeriods.push(element._source.period_ending);
			  fileTypes.push(element._source.file_type)
			  filingURLs.push(`https://www.sec.gov/Archives/edgar/data/${param1}/${param2}/xslForm13F_X01/${param3}`);
			  requests.push(`https://www.sec.gov/Archives/edgar/data/${param1}/${param2}/${param3}-index.html`);
			  fillingDates.push(element._source.file_date)
			  fillers.push(element._source.display_names[0]);
			  cusips.push(element._source.ciks[0])
			  
			    let original = {
					name: element._source.display_names[0],
					cusip: element._source.ciks[0],
					fillingDate: element._source.file_date,
					reportingFor: element._source.period_ending,
					url: `https://www.sec.gov/Archives/edgar/data/${param1}/${param2}/${param3}-index.html`
			    }
				completeData.push(original)
		  }

		});
		console.log("13Fs", filingURLs.length, filingURLs);
		(async () => {
			const responses = await getResults(completeData);
			let companyArray = []

			fs.writeFile('./13fs.json', "got nothing", function() {
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
			})

		})();	

		

	  })
	  .catch(error => {
		console.error(error, filingURLs)
	  })
}
runner()