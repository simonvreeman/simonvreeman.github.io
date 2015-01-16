// SUDOKU SOLVER
// Lukas Vermeer

var cellSize = 55;
var numDepth = 9;
var delay = 1;
var progress = false;
var play = false;
var save = new Array();
var savecolor = new Array();

var guessing = false;
var guess = new Array();;
var guessdepth = 1;

var curguess = new Array();
var curguessx = new Array();
var curguessy = new Array();

//var goodguess = -1;
//var goodguessx = 0;
//var goodguessy = 0;

stat_loops = 0;
stat_lvl = new Array();

function mod3(i) { return Math.floor(i / 3) * 3; }
function rest3(i) { return i % 3 * 3; }
function compareContents(a,b) { for (i=0;i<Math.max(a.length,b.length);i++) { if (a[i]!=b[i]) return false; } return true; }

function verbose(v) { if (v == null) { v = '...'; } document.getElementById('verbose').innerHTML = v; }

function writeField() {
	//grid table
	a = document.createElement('table');
	a.id = 'grid';
	a.setAttribute('border','1');
	document.getElementById('field').appendChild(a);

	//grid
	for (i = 0; i < 9; i++) {
		if (i == 3 || i == 6) {
			//block-divider horizontal
			d = document.createElement('tr');
			document.getElementById('grid').appendChild(d);

			e = document.createElement('td');
			e.setAttribute('class','black');
			e.setAttribute('colspan','12');
			document.getElementById('grid').appendChild(e);	
		}
		
		//grid rows
		b = document.createElement('tr');
		b.id = 'row_' + i;
		document.getElementById('grid').appendChild(b);
		
		//grid cols
		for (j = 0; j < 9; j++) {
			if (j == 3 || j == 6) {
				//block-divider vertical
				e = document.createElement('td');
				e.setAttribute('class','black');
				document.getElementById('row_' + i).appendChild(e);	
			}

			c = document.createElement('td');
			c.id = 'cell_' + i + '_' + j;
			c.innerHTML = '&nbsp;';
			c.setAttribute('width',cellSize);
			c.setAttribute('height',cellSize);
			c.setAttribute('onClick','cellClick('+i+','+j+');');
			document.getElementById('row_' + i).appendChild(c);
	
			//cell data
			d = document.createElement('span');
			d.id = 'data_' + i + '_' + j;
			d.setAttribute('class','cell');
			document.getElementById('cell_' + i + '_' + j).appendChild(d);
			//cell posibilities
			for (o = 1; o <= 9; o++) {
				p = document.createElement('span');
				p.id = 'ex_' + i + '_' + j + '_' + o;
				p.innerHTML = o;
				p.setAttribute('class','ex');
				document.getElementById('cell_' + i + '_' + j).appendChild(p);
			}
		}
	}
	
	//controls
	writeButton('solve','solve','menu','solveLoop(-2)');
	writeButton('reset','reset','menu','writeReset()');
	writeButton('clear','clear','menu','writeClear()');
	writeButton('save','save state','menu','saveData(0)');
	writeButton('load','load state','menu','loadData(0)');
	writeButton('easy','easy example','menu','preset(1)');
	writeButton('medium','medium example','menu','preset(2)');
	writeButton('hard','hard example','menu','preset(3)');
	writeButton('impossible','impossible example','menu','preset(4)');
	writeButton('insane','insane example','menu','preset(5)');
	writeButton('impossible','impossible example','menu','preset(6)');
	
	for (i = 0; i < numDepth; i++) { stat_lvl[i] = 0; }
	//for (i = 0; i < numDepth; i++) {
	//	for (j = 0; j < numDepth; j++) { save[i + (j*9)] = 0; savecolor[i + (j*9)]; } }

	verbose(); }

function writeButton(id, name, parent, action) {
	//create a button
	b = document.createElement('a');
	b.id = id;
	b.innerHTML = name;
	b.setAttribute('class','button');
	b.setAttribute('onClick', action);
	b.setAttribute('href','#');

	c = document.createElement('br');

	document.getElementById(parent).appendChild(b);
	document.getElementById(parent).appendChild(c);
}

function updateStats() {
	stat = '<table><tr><td width=100 align=right>loops</td><td width=20></td><td>' + stat_loops + '</td></tr>';
	for (i = 0; i < numDepth; i++) {
		if (0 != stat_lvl[i]) { stat+='<tr><td align=right>lvl '+i+'</td><td></td><td>'+stat_lvl[i]+'</td></tr>'; } }
	stat += '</table>'
	document.getElementById('datafield').innerHTML = stat;
}

function cellClick (i,j) {
	//a cell is clicked
	if (!play) {
		p = prompt('waarde voor ' + i + ', ' + j);
		if ((p <= 9 && p >= 1) || p == '') { cellSet(i,j,p); }
		else { alert('onjuiste waarde'); } } }
	
function cellSet(i,j,k) {
	//set value of cell i,j to k (k e {null|1-9})
	cellGet(i,j).innerHTML = k;
	if (k != '') {	for (o = 1; o <= 9; o++) { exSet(i,j,o,''); } }
	else {		for (o = 1; o <= 9; o++) { exSet(i,j,o,o); } }
}
function exSet(i,j,a,o) { x = exGet(i,j,a); x.innerHTML = o; if (o=='') { x.setAttribute('class','ex hidden'); } else { x.setAttribute('class','ex'); } }
function cellGet(i,j) {	return document.getElementById('data_'+i+'_'+j); }
function exGet(i,j,k) { return document.getElementById('ex_'+i+'_'+j+'_'+k); }
function getOptions(i,j) {
	r = new Array();
	for (o = 1; o <= numDepth; o++) {
		x = exGet(i,j,o).innerHTML;
		if (x != '') { r[r.length] = o; } } return r; }
function exBlank(i,j) { for (o = 1; o <= 9; o++) { exSet(i,j,o,''); } }

function writeReset() {
	for (i = 0; i < numDepth; i++) {
		for (j = 0; j < numDepth; j++) {
			c = cellGet(i,j);
			if (c.getAttribute('class') != 'cell') {
				c.innerHTML = ''; }
			for (k = 1; k <= numDepth; k++) { 
				if (c.innerHTML == '') { exSet(i,j,k,k); exGet(i,j,k).setAttribute('class','ex'); } } } } }

function writeClear() {
	for (i = 0; i < numDepth; i++) {
		for (j = 0; j < numDepth; j++) {
			c = cellGet(i,j);
			if (c.getAttribute('class') == 'cell') {
				c.innerHTML = ''; } } }
	writeReset(); }

function recursive(func) { timerID=setTimeout(func, delay); }

function buttonSwitch(id,tag,func) {
	b = document.getElementById(id);
	b.innerHTML = tag;
	b.setAttribute('onClick',func); }

function stopLoop() {
	play = false;
	buttonSwitch('solve','solve','solveLoop(-2)'); }

function saveData(d) {
	off = d * 100;
	for (i = 0; i < numDepth; i++) {
		for (j = 0; j < numDepth; j++) {
			a = cellGet(i,j).innerHTML;
			c = cellGet(i,j).getAttribute('class');
			if (a != '') { save[j + (i*9) + off] = a; savecolor[j + (i*9) + off] = c; }
			else { save[j + (i*9) + off] = 0; savecolor[j + (i*9) + off] = 'cell'; } } } }

function loadData(d) {
	off = d * 100;
	for (i = 0; i < numDepth; i++) {
		for (j = 0; j < numDepth; j++) {
			if (save[j + (i*9) + off] == 0) { 
				cellSet(i,j,''); }
			else { 
				cellSet(i,j,save[j + (i*9) + off]); }
			cellGet(i,j).setAttribute('class',savecolor[j + (i*9) + off]); } } }

function solveLoop(i) {
	updateStats();
	if (!play) {
		verbose();
		if (i==-2) {
			play = true;
			buttonSwitch('solve','stop','stopLoop()');
			verbose('saving');
			saveData(0);
			solveLoop(0); } }
	else {
		if (i==0) {
			progress = false;
			stat_loops++;
			verbose('checking for end and lock');
			checkEndRecursive(0,0,true); }
		if (i==9) {
			verbose('calculating exclusions');
			genExclusionsRecursive(0,0); }
		if (i==1) {
			verbose('eliminating cells');
			genEliminateRecursive(0,0); }
		if (i==2) {
			if (!progress)	{ verbose('extrapolating level 1'); genExtrapolateRecursive(0,0); }
			else		{ solveLoop(0); } }
		if (i==3) {		
			if (!progress)	{ verbose('extrapolating level 2'); genExtrapolateRecursive(0,1); }
			else		{ solveLoop(0); } }
		if (i==4) {		
			if (!progress)	{ verbose('extrapolating level 3'); genExtrapolateRecursive(0,2); }
			else		{ solveLoop(0); } }
		if (i==5) {
			if (!progress)	{ verbose('guessing'); genGuess(guessdepth); } 
			else		{ solveLoop(0); } } 
		if (i==6) {
			if (!progress)	{ verbose('no solution!'); stopLoop(); }
			else		{ solveLoop(0) } } } }

function lockResolution() {
	if (!guessing) {
		verbose('permanent lock!'); stopLoop(); }
	else {
		unGuess(); } }
		
function checkEndRecursive(i,j,t) {
	if (i >= numDepth) { i -= numDepth; j++; }
	if (!(j >= numDepth)) {
		a = cellGet(i,j).innerHTML;
		if (a == '') { t = false; }
		checkEndRecursive(++i,j,t); }
	else { 
		if (t) { verbose('finished!'); stopLoop(); }
		else { checkLockedRecursive(0,0,true); } } }

function checkLockedRecursive(i,j,t) {
	if (i >= numDepth) { i -= numDepth; j++; }
	if (!(j >= numDepth)) {
		a = cellGet(i,j).innerHTML;
		b = getOptions(i,j);
		if (a == '' && b.length == 0) { t = false; }
		checkLockedRecursive(++i,j,t); }
	else { 
		if (!t) { lockResolution(); }
		else { solveLoop(9); } } }

function genExclusionsRecursive(i,j) {
	if (i >= numDepth) { i -= numDepth; j++; }
	if (!(j >= numDepth)) {
		a = cellGet(i,j).innerHTML;
		if (a != '') { genExclusion(i,j,a); }
		genExclusionsRecursive(++i,j); }
	else { solveLoop(1); } }

function genExclusion(i,j,a) {
	for (o = 0; o < numDepth; o++) { exSet(o,j,a,''); exSet(i,o,a,''); }
	offseti = mod3(i); offsetj = mod3(j);
	for (o = offseti; o < (offseti+Math.pow(numDepth,0.5)); o++) {
		for (p = offsetj; p < (offsetj+Math.pow(numDepth,0.5)); p++) {
			exSet(o,p,a,''); } } }

function genExclude(i,j,k,t) {
	if (t == 0) {
		for (x = 0; x < numDepth; x++) {
			exSet(x,j,k,''); } }
	if (t == 1) {
		for (x = 0; x < numDepth; x++) {
			exSet(i,x,k,''); } }
	if (t == 2) {
		i_offset = mod3(i);
		j_offset = mod3(j);
		for (x = 0; x < numDepth; x++) {
			exSet(toBlockX(x) + i_offset,toBlockY(x) + j_offset,k,''); } }
}

function genEliminateRecursive(i,j) {
	updateStats();
	if (i >= numDepth) { i -= numDepth; j++; }
	if (!(j >= numDepth)) {
		q = getOptions(i,j);
		if (q.length==1) { 
			cellSet(i,j,q[0]);
			if (cellGet(i,j).getAttribute('class') == 'cell') { cellGet(i,j).setAttribute('class','cell elimin'); }
			genExclusion(i,j,q[0]);
			progress = true; 
			stat_lvl[0]++; 
			recursive('genEliminateRecursive('+(++i)+','+j+')'); } 
		else { genEliminateRecursive(++i,j); } } 
	else { solveLoop(2); } } 

function genExtrapolateRecursive(i,t) {
	if (t == 0) { t_0 = 'j'; t_1 = 'i'; t_2 = 'y[l]'; t_3 = 'i'; t_4 = 'cell extrapol'; nextloop = 3; }
	if (t == 1) { t_0 = 'i'; t_1 = 'j'; t_2 = 'i'; t_3 = 'y[l]'; t_4 = 'cell extrapol'; nextloop = 4}
	if (t == 2) { t_0 = 'toBlockX(j) + mod3(i)'; t_1 = 'toBlockY(j) + rest3(i)'; t_2 = 'toBlockX(y[l]) + mod3(i)'; t_3 = 'toBlockY(y[l]) + rest3(i)'; t_4 = 'cell extrapol'; nextloop = 5; }
	updateStats();
	if (i < numDepth) {
		w = new Array();
		for (k = 1; k <= numDepth; k++) { w[k] = new Array(); }
		for (j = 0; j < numDepth; j++) {
			p = getOptions(eval(t_0),eval(t_1));
			for (l = 0; l < p.length; l++) {
				y = w[p[l]];
				y[y.length] = j; } }
		for (k = 1; k <= numDepth; k++) {
			y = w[k];
			r = genLinkingBlocks(y,w,k);
			if (r.length == (y.length + 1)) {
				rr = r[y.length];
				for (l = 0; l < y.length; l++) {
					xxx = eval(t_2);
					yyy = eval(t_3);
					if (!compareContents(rr,getOptions(xxx, yyy))) {
						for (ll = 0; ll < y.length; ll++) {
							genExclude(xxx,yyy,rr[ll],t); } } }
				pro = false;
				for (l = 0; l < y.length; l++) {
					xxx = eval(t_2);
					yyy = eval(t_3);
					if (!compareContents(rr,getOptions(xxx, yyy))) {
						pro = true; 
						exBlank(xxx,yyy);
						cellGet(xxx,yyy).setAttribute('class',t_4);
						for (m = 0; m < y.length; m++) { 
							exSet(xxx, yyy, rr[m],rr[m]); } } }
				if (pro) { progress = true; stat_lvl[y.length]++; } } }
		recursive('genExtrapolateRecursive('+(++i)+','+t+')'); } 
	else { solveLoop(nextloop); } } 

function genGuess(d) {
	guessing = true;
	done = false;
	end = false;
	saveData(d);
	p = 9; a = 0; b = 0;
	if (guess[d] == null) { guess[d] = 0; }
	countdown = guess[d];
	for (i = 0; i < numDepth && !done; i++) {
		for (j = 0; j < numDepth && !done; j++) {
			if (cellGet(i,j).innerHTML == '') { 
				o = getOptions(i,j);
				if (o.length < p) { 
					a = i; b = j; p = o.length; } } } } 
	o = getOptions(a,b);
	if (o.length > countdown) {
		for (k = 0; k < o.length && !done; k++) { 
			if (countdown == 0) {
				curguess[d] = o[k];
				curguessx[d] = a;
				curguessy[d] = b;
				guessdepth++;
				done = true;
				cellSet(a,b,o[k]);
				cellGet(a,b).setAttribute('class','cell guess'); }
			countdown--; } }
	else { end = true; alert('no solution at this level'); guessdepth--; unGuess(); }
	
	if (!end) { solveLoop(0); } }

function unGuess() {
	guessdepth--;
	if (guessdepth >= 1) {
		loadData(guessdepth);
		guess[guessdepth]++;
		solveLoop(0); }
	else {
		verbose('no sollution (not even with guessing)!'); stopLoop(); } }

function genLinkingBlocks(original, collection, startPos) {
	r = new Array(); // positions
	rr = new Array(); // numbers
	for (kk = startPos; kk <= numDepth; kk++) {
		yy = collection[kk];
		if (yy.length == original.length) {
			if (compareContents(original,yy)) {
				r[r.length] = kk; rr[rr.length] = kk; } } } 
	r[r.length] = rr;
	return r; }

function toBlockX(i) { return (mod3(i) / 3); }
function toBlockY(i) { return (i - mod3(i)); }

function preset(i) {
	if (i==1) { cellSet(0,2,7); cellSet(0,3,2); cellSet(0,8,5); cellSet(1,0,6); cellSet(1,1,2); cellSet(1,5,8); cellSet(1,7,4); cellSet(2,0,9); cellSet(2,1,5); cellSet(2,4,3); cellSet(3,3,3); cellSet(4,1,1); cellSet(4,2,9); cellSet(4,4,7); cellSet(4,5,4); cellSet(5,2,3); cellSet(5,3,9); cellSet(5,5,6); cellSet(5,7,7); cellSet(6,0,5); cellSet(6,1,7); cellSet(6,6,9); cellSet(6,8,6); cellSet(7,1,9); cellSet(7,3,1); cellSet(7,8,8); cellSet(8,3,6); cellSet(8,6,4); cellSet(8,7,5); cellSet(8,8,3); }
	if (i==2) { cellSet(0,3,3); cellSet(0,5,8); cellSet(0,7,6); cellSet(1,0,4); cellSet(1,2,7); cellSet(1,3,6); cellSet(2,2,1); cellSet(2,5,2); cellSet(2,6,4); cellSet(3,0,2); cellSet(3,1,8); cellSet(3,5,4); cellSet(3,6,7); cellSet(4,1,1); cellSet(4,7,3); cellSet(5,2,4); cellSet(5,3,9); cellSet(5,7,1); cellSet(5,8,2); cellSet(6,2,8); cellSet(6,3,2); cellSet(6,6,3); cellSet(7,5,1); cellSet(7,6,2); cellSet(7,8,9); cellSet(8,1,2); cellSet(8,3,8); cellSet(8,5,6); }
	if (i==3) { cellSet(0,1,1);cellSet(0,7,8); cellSet(1,2,5); cellSet(1,4,1); cellSet(1,6,3); cellSet(2,1,4); cellSet(2,3,8); cellSet(2,5,3); cellSet(2,8,5); cellSet(3,0,9); cellSet(3,3,2); cellSet(3,4,6); cellSet(3,8,4); cellSet(4,1,3); cellSet(4,7,5); cellSet(5,0,2); cellSet(5,4,3); cellSet(5,5,4); cellSet(5,8,7); cellSet(6,0,1); cellSet(6,3,6); cellSet(6,5,2); cellSet(6,7,9); cellSet(7,2,6); cellSet(7,4,8); cellSet(7,6,7); cellSet(8,1,2); cellSet(8,7,6); } 
	if (i==4) { cellSet(0,0,9);cellSet(0,1,5);cellSet(0,6,6);cellSet(0,7,7);cellSet(1,5,7);cellSet(1,6,3);cellSet(1,7,1);cellSet(2,0,8);cellSet(2,3,5);cellSet(2,4,6);cellSet(2,5,1);cellSet(3,0,2);cellSet(3,1,3);cellSet(4,2,9);cellSet(4,6,1);cellSet(5,7,3);cellSet(5,8,7);cellSet(6,3,1);cellSet(6,4,4);cellSet(6,5,5);cellSet(6,8,9);cellSet(7,1,9);cellSet(7,2,4);cellSet(7,3,2);cellSet(8,1,8);cellSet(8,2,5);cellSet(8,7,2);cellSet(8,8,1); }
	if (i==5) { cellSet(0,1,7); cellSet(0,3,9); cellSet(0,6,5); cellSet(1,2,1); cellSet(1,4,2); cellSet(1,8,4); cellSet(2,0,3); cellSet(2,5,7); cellSet(3,1,8); cellSet(3,5,5); cellSet(3,7,9); cellSet(4,3,2); cellSet(4,4,3); cellSet(4,6,6); cellSet(5,2,4); cellSet(6,0,6); cellSet(6,4,1); cellSet(6,7,5); cellSet(7,3,8); cellSet(7,8,7); cellSet(8,1,9); cellSet(8,2,2); cellSet(8,8,3); }
	if (i==6) { cellSet(0,0,1); cellSet(1,0,4); cellSet(2,2,9); cellSet(0,3,4); cellSet(1,4,8); cellSet(0,6,7); cellSet(1,6,1); cellSet(2,8,6); cellSet(5,0,9); cellSet(5,2,2); cellSet(3,3,6); cellSet(4,3,9); cellSet(4,5,2); cellSet(3,6,9); cellSet(5,6,6); cellSet(4,8,5); cellSet(6,0,5); cellSet(8,0,2); cellSet(6,3,8); cellSet(7,3,2); cellSet(8,3,5); cellSet(6,8,4); cellSet(7,7,6); cellSet(8,8,1);} }
