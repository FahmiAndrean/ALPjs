const LineAPI = require('./api');
const { Message, OpType, Location } = require('../curve-thrift/line_types');
let exec = require('child_process').exec;

const myBot = ['u7b8f35567fee016d196112004b6e3573','u95398154aeacc458d63ca8f99dfde1e8','u5e7cbf89cc248b791ff90cd12498d58d'];


function isAdminOrBot(param) {
    return myBot.includes(param);
}


class LINE extends LineAPI {
    constructor() {
        super();
        this.receiverID = '';
        this.checkReader = [];
        this.stateStatus = {
            ac: 0,
            ak: 0,
        }
    }

    getOprationType(operations) {
        for (let key in OpType) {
            if(operations.type == OpType[key]) {
                if(key !== 'NOTIFIED_UPDATE_PROFILE') {
                    console.info(`[* ${operations.type} ] ${key} `);
                }
            }
        }
    }

    poll(operation) {
        if(operation.type == 25 || operation.type == 26) {
            // console.log(operation);
            const txt = (operation.message.text !== '' && operation.message.text != null ) ? operation.message.text : '' ;
            let message = new Message(operation.message);
            this.receiverID = message.to = (operation.message.to === myBot[0]) ? operation.message.from_ : operation.message.to ;
            Object.assign(message,{ ct: operation.createdTime.toString() });
            this.textMessage(txt,message)
        }

        if(operation.type == 13 && this.stateStatus.mc == 1) {
            this.cancelAll(operation.param1);
        }

        if(operation.type == 19) { //ada kick
            // op1 = group nya
            // op2 = yang 'nge' kick
            // op3 = yang 'di' kick
            if(isAdminOrBot(operation.param2)) {
                this._kickMember(operation.param1,[operation.param2]);
                this._inviteIntoGroup(operation.param1,[operation.param3]);
            } 

        }

        if(operation.type == 55){ //ada reader

            const idx = this.checkReader.findIndex((v) => {
                if(v.group == operation.param1) {
                    return v
                }
            })
            if(this.checkReader.length < 1 || idx == -1) {
                this.checkReader.push({ group: operation.param1, users: [operation.param2], timeSeen: [operation.param3] });
            } else {
                for (var i = 0; i < this.checkReader.length; i++) {
                    if(this.checkReader[i].group == operation.param1) {
                        if(!this.checkReader[i].users.includes(operation.param2)) {
                            this.checkReader[i].users.push(operation.param2);
                            this.checkReader[i].timeSeen.push(operation.param3);
                        }
                    }
                }
            }
        }

        if(operation.type == 13) { // diinvite
            if(isAdminOrBot(operation.param2)) {
                return this._acceptGroupInvitation(operation.param1);
            } else {
                return this._cancel(operation.param1,myBot);
            }
        }
        this.getOprationType(operation);
    }

    async cancelAll(gid) {
        let { listPendingInvite } = await this.searchGroup(gid);
        if(listPendingInvite.length > 0){
            this._cancel(gid,listPendingInvite);
        }
    }

    async searchGroup(gid) {
        let listPendingInvite = [];
        let thisgroup = await this._getGroups([gid]);
        if(thisgroup[0].invitee !== null) {
            listPendingInvite = thisgroup[0].invitee.map((key) => {
                return key.mid;
            });
        }
        let listMember = thisgroup[0].members.map((key) => {
            return { mid: key.mid, dn: key.displayName };
        });

        return { 
            listMember,
            listPendingInvite
        }
    }

    setState(seq) {
        if(isAdminOrBot(seq.from)){
            let [ actions , status ] = seq.text.split(' ');
            const action = actions.toLowerCase();
            const state = status.toLowerCase() == 'on' ? 1 : 0;
            this.stateStatus[action] = state;
            this._sendMessage(seq,`Status: \n${JSON.stringify(this.stateStatus)}`);
        } else {
            this._sendMessage(seq,`Keyword SysTeM khusus FahmiAndrean`);
        }
    }

    mention(listMember) {
        let mentionStrings = [''];
        let mid = [''];
        for (var i = 0; i < listMember.length; i++) {
            mentionStrings.push('@'+listMember[i].displayName+'\n');
            mid.push(listMember[i].mid);
        }
        let strings = mentionStrings.join('');
        let member = strings.split('@').slice(1);
        
        let tmp = 0;
        let memberStart = [];
        let mentionMember = member.map((v,k) => {
            let z = tmp += v.length + 1;
            let end = z - 1;
            memberStart.push(end);
            let mentionz = `{"S":"${(isNaN(memberStart[k - 1] + 1) ? 0 : memberStart[k - 1] + 1 ) }","E":"${end}","M":"${mid[k + 1]}"}`;
            return mentionz;
        })
        return {
            names: mentionStrings.slice(1),
            cmddata: { MENTION: `{"MENTIONEES":[${mentionMember}]}` }
        }
    }

    async leftGroupByName(payload) {
        let gid = await this._findGroupByName(payload);
        for (var i = 0; i < gid.length; i++) {
            this._leaveGroup(gid[i]);
        }
    }
    
    async check(cs,group) {
        let users;
        for (var i = 0; i < cs.length; i++) {
            if(cs[i].group == group) {
                users = cs[i].users;
            }
        }
        
        let contactMember = await this._getContacts(users);
        return contactMember.map((z) => {
                return { displayName: z.displayName, mid: z.mid };
            });
    }

    removeReaderByGroup(groupID) {
        const groupIndex = this.checkReader.findIndex(v => {
            if(v.group == groupID) {
                return v
            }
        })

        if(groupIndex != -1) {
            this.checkReader.splice(groupIndex,1);
        }
    }

    async textMessage(textMessages, seq) {
        let [ cmd, ...payload ] = textMessages.split(' ');
        payload = payload.join(' ');
        let txt = textMessages.toLowerCase();
        let messageID = seq.id;

        if(cmd == 'MiCancel') {
            if(payload == 'group') {
                let groupid = await this._getGroupsInvited();
                for (let i = 0; i < groupid.length; i++) {
                    this._rejectGroupInvitation(groupid[i])                    
                }
            }
        }

        if(txt == 'halo' || txt == 'respon') {
            this._sendMessage(seq, 'this SysTeM creator is line.me/ti/p/~fahmiadrn');
        }

	if(txt == 'keyword' || txt == 'help' || txt == 'key') {
	    this._sendMessage(seq, '[Umum]:\n1.respon/halo\n2.Mispeed\n3.MiPoint\n4.MiCheck\n5.Mireset\n6.myid\n7.openurl\n8.closeurl\n9.join\n\n[SysTeM Fahmi]:\n1.deffkick on/off\n2.deffcancel on/off\n3.micancel\n4.spm\n5.SysTembye\n6.SysTemabsen');
	}

        if(txt == 'mispeed') {
            const curTime = (Date.now() / 1000);
            await this._sendMessage(seq,'SysTeM sedang berjalan....');
            const rtime = (Date.now() / 1000) - curTime;
            await this._sendMessage(seq, `${rtime} crot`);
        }

        if(txt == 'micungur' && isAdminOrBot(seq.from)) {
            let { listMember } = await this.searchGroup(seq.to);
            for (var i = 0; i < listMember.length; i++) {
                if(!isAdminOrBot(listMember[i].mid)){
                    this._kickMember(seq.to,[listMember[i].mid])
                }
            }
        }

        if(txt == 'mipoint') {
            this._sendMessage(seq, `Read point telah di set!`);
            this.removeReaderByGroup(seq.to);
        }

        if(txt == 'mireset') {
            this.checkReader = []
            this._sendMessage(seq, `Read point telah di reset!`);
        }

	if(txt == 'SysTeMabsen' && isAdminOrBot (seq.from)) {
            let rec = await this._getGroup(seq.to);
            const mentions = await this.mention(rec.members);
   	    seq.contentMetadata = mentions.cmddata;
            await this._sendMessage(seq,mentions.names.join(''));
        }

        if(txt == 'micheck') {
            let rec = await this.check(this.checkReader,seq.to);
            const mentions = await this.mention(rec);
            seq.contentMetadata = mentions.cmddata;
            await this._sendMessage(seq,mentions.names.join(''));
            
        }
        if(seq.contentType == 13) {
            seq.contentType = 0
            this._sendMessage(seq,seq.contentMetadata.mid);
        }
	
        const action = ['deffcancel on','deffcancel off','deffkick on','deffkick off']
        if(action.includes(txt)) {
            this.setState(seq)
        } 

	if(txt == 'creator') {
	    const mid = ['u7b8f35567fee016d196112004b6e3573'];
	    const contact = this._getContacts(mid);
	    this._sendMessage(seq, 'SysTeM line.me/ti/p/~fahmiadrn');
	}

        if(txt == 'myid') {
            this._sendMessage(seq,`SysTeM MID: ${seq.from}`);
        }

        const joinByUrl = ['openurl','closeurl'];
        if(joinByUrl.includes(txt)) {
            let updateGroup = await this._getGroup(seq.to);
            updateGroup.preventJoinByTicket = true;
            if(txt == 'open') {
                updateGroup.preventJoinByTicket = false;
                const groupUrl = await this._reissueGroupTicket(seq.to)
                this._sendMessage(seq,`line.me/R/ti/g/${groupUrl}`);
            }
            await this._updateGroup(updateGroup);
        }

        if(cmd == 'join') { //untuk join group pake qrcode contoh: join line://anu/g/anu
            const [ ticketId ] = payload.split('g/').splice(-1);
            let { id } = await this._findGroupByTicket(ticketId);
            await this._acceptGroupInvitationByTicket(id,ticketId);
        }

        if(cmd == 'spm' && isAdminOrBot(seq.from)) { // untuk spam invite contoh: spm <mid>
            for (var i = 0; i < 4; i++) {
                this._createGroup(`SPAM`,payload);
            }
        }
        
        if(txt == 'SysTeMbye' && isAdminOrBot(seq.from)) {
          let txt = await this._sendMessage(seq, 'Goodbye all be a good guys\n*SelfBot Corporation*');if(txt == 'SysTeMbye' && isAdminOrBot(seq.from)) { //untuk left dari group atau spam group contoh left <alfath>
        }

    }

}

module.exports = new LINE();
