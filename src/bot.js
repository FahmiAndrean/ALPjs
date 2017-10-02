const LineConnect = require('./connect');
let LINE = require('./main.js');

const auth = {
	authToken: 'ElypGusUWQlKR2OpUOC3.E481vN+Uaw0zyrias241CW.q8ScOGuCK/2z118TAi1t5QirB8qzuxqlVNeLrKUzqJE=',
	certificate: '',
}
// let client =  new LineConnect(auth);
let client =  new LineConnect();

client.startx().then(async (res) => {
	
	while(true) {
		try {
			ops = await client.fetchOps(res.operation.revision);
		} catch(error) {
			console.log('error',error)
		}
		for (let op in ops) {
			if(ops[op].revision.toString() != -1){
				res.operation.revision = ops[op].revision;
				LINE.poll(ops[op])
			}
		}
	}
});
