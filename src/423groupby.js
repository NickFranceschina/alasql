/*
//
// Select compiler part for Alasql.js
// Date: 03.11.2014
// (c) 2014, Andrey Gershun
//
*/

/**
 Compile group of statements
 */
yy.Select.prototype.compileGroup = function (query) {
	//	console.log(this.group);
	if (query.sources.length > 0) {
		var tableid = query.sources[0].alias;
	} else {
		// If SELECT contains group aggregators without source tables
		var tableid = '';
	}
	var defcols = query.defcols;
	//	console.log(16,tableid, defcols);

	//	console.log(query.sources[0].alias,query.defcols);
	var allgroup = [[]];
	if (this.group) {
		allgroup = decartes(this.group, query);
	}
	//	console.log(23,allgroup);

	//	console.log(allgroup);
	// Prepare groups
	//var allgroup = [['a'], ['a','b'], ['a', 'b', 'c']];

	// Union all arrays to get a maximum
	var allgroups = [];
	allgroup.forEach(function (a) {
		allgroups = arrayUnion(allgroups, a);
	});

	query.allgroups = allgroups;

	query.ingroup = [];
	var s = '';
	//	s+= query.selectfns;
	allgroup.forEach(function (agroup) {
		// Start of group function
		s += 'var g=this.xgroups[';

		//	var gcols = this.group.map(function(col){return col.columnid}); // Group fields with r
		// Array with group columns from record
		var rg = agroup.map(function (col2) {
			var columnid = col2.split('\t')[0];
			var coljs = col2.split('\t')[1];
			// Check, if aggregator exists but GROUP BY is not exists
			if (columnid === '') {
				return '1'; // Create fictive grouping column for fictive GROUP BY
			}
			//			else return "r['"+columnid+"']";
			query.ingroup.push(columnid);
			//			console.log(429,87,query.ingroup);
			return coljs;
		});

		if (rg.length === 0) {
			rg = ["''"];
		}

		//	console.log('rg',rg);

		s += rg.join('+"`"+');
		s += '];if(!g) {this.groups.push((g=this.xgroups[';
		s += rg.join('+"`"+');
		s += '] = {';
		//		s += ']=r';
		s += agroup
			.map(function (col2) {
				var columnid = col2.split('\t')[0];
				var coljs = col2.split('\t')[1];

				if (columnid === '') {
					return '';
				}
				return "'" + columnid + "':" + coljs + ',';
			})
			.join('');
		//console.log(agroup);
		var neggroup = arrayDiff(allgroups, agroup);

		//		console.log(neggroup);

		s += neggroup
			.map(function (col2) {
				var columnid = col2.split('\t')[0];
				//	var coljs = col2.split('\t')[1]
				return "'" + columnid + "':null,";
			})
			.join('');
		//console.log(neggroup);
		var aft = '',
			aft2 = '';

		if (typeof query.groupStar !== 'undefined') {
			aft2 += "for(var f in p['" + query.groupStar + "']) {g[f]=p['" + query.groupStar + "'][f];};";
		}

		/*
		 */
		//		s += self.columns.map(function(col){
		//console.log('query.selectGroup',query.selectGroup);
		s += query.selectGroup
			.map(function (col) {
				//console.log(idx, col.toString(), col.as);
				var colexp = col.expression.toJS('p', tableid, defcols);
				var colas = col.nick;
				// if(typeof colas == 'undefined') {
				// 	if(col instanceof yy.Column) colas = col.columnid;
				// 	else colas = col.toString();
				// };
				let colExpIfFunIdExists = expression => {
					let colexpression = expression.args[0];
					return colexpression.toJS('p', tableid, defcols);
				};
				if (col instanceof yy.AggrValue) {
					if (col.distinct) {
						aft +=
							",g['$$_VALUES_" + colas + "']={},g['$$_VALUES_" + colas + "'][" + colexp + ']=true';
					}
					if (col.aggregatorid === 'SUM') {
						if ('funcid' in col.expression) {
							let colexp1 = colExpIfFunIdExists(col.expression);
							return `'${colas}':(${colexp1})|| typeof ${colexp1} == 'number' ? ${colexp} : null,`;
						}
						return `'${colas}':(${colexp})|| typeof ${colexp} == 'number' ? ${colexp} : null,`;
					} else if (col.aggregatorid === 'TOTAL') {
						if ('funcid' in col.expression) {
							let colexp1 = colExpIfFunIdExists(col.expression);
							return `'${colas}':(${colexp1}) || typeof ${colexp1} == 'number' ?
							${colexp1} : ${colexp1} == 'string' && typeof Number(${colexp1}) == 'number' ? Number(${colexp1}) :
							typeof ${colexp1} == 'boolean' ?  Number(${colexp1}) : 0,`;
						}
						return `'${colas}':(${colexp})|| typeof ${colexp} == 'number' ?
							${colexp} : ${colexp} == 'string' && typeof Number(${colexp}) == 'number' ? Number(${colexp}) :
							typeof ${colexp} === 'boolean' ?  Number(${colexp}) : 0,`;
					} else if (
						col.aggregatorid === 'FIRST' ||
						col.aggregatorid === 'LAST'
						//					|| col.aggregatorid == 'AVG'
						//							) { return "'"+col.as+'\':r[\''+col.as+'\'],'; }//f.field.arguments[0].toJS();
					) {
						return "'" + colas + "':" + colexp + ','; //f.field.arguments[0].toJS();
					} else if (col.aggregatorid === 'MIN') {
						if ('funcid' in col.expression) {
							let colexp1 = colExpIfFunIdExists(col.expression);

							return(`'${colas}': (typeof ${colexp1} == 'number' ? ${colexp} : typeof ${colexp1} == 'object' ?
							typeof Number(${colexp1}) == 'number' && ${colexp1}!== null? ${colexp} : null : null),`);
						}
						return `'${colas}': (typeof ${colexp} == 'number' ? ${colexp} : typeof ${colexp} == 'object' ?
							typeof Number(${colexp}) == 'number' && ${colexp}!== null? ${colexp} : null : null),`;
					} else if (col.aggregatorid === 'MAX') {
						if ('funcid' in col.expression) {
							let colexp1 = colExpIfFunIdExists(col.expression);
							return `'${colas}' : (typeof ${colexp1} == 'number' ? ${colexp} : typeof ${colexp1} == 'object' ?
							typeof Number(${colexp1}) == 'number' ? ${colexp} : null : null),`;
						}
						return `'${colas}' : (typeof ${colexp} == 'number' ? ${colexp} : typeof ${colexp} == 'object' ?
							typeof Number(${colexp}) == 'number' ? ${colexp} : null : null),`;
					} else if (col.aggregatorid === 'ARRAY') {
						return "'" + colas + "':[" + colexp + '],';
					} else if (col.aggregatorid === 'COUNT') {
						if (col.expression.columnid === '*') {
							return "'" + colas + "':1,";
						} else {
							//						return "'"+colas+'\':(typeof '+colexp+' != "undefined")?1:0,';
							//					} else {
							return (
								"'" +
								colas +
								"':(typeof " +
								colexp +
								' == "undefined" || ' +
								colexp +
								' === null) ? 0 : 1,'
							);
						}

						//				else if(col.aggregatorid == 'MIN') { return "'"+col.as+'\':r[\''+col.as+'\'],'; }
						//				else if(col.aggregatorid == 'MAX') { return "'"+col.as+'\':r[\''+col.as+'\'],'; }
					} else if (col.aggregatorid === 'AVG') {
						query.removeKeys.push('_SUM_' + colas);
						query.removeKeys.push('_COUNT_' + colas);

						return (
							'' +
							"'" +
							colas +
							"':" +
							colexp +
							",'_SUM_" +
							colas +
							"':(" +
							colexp +
							")||0,'_COUNT_" +
							colas +
							"':(typeof " +
							colexp +
							' == "undefined" || ' +
							colexp +
							' === null) ? 0 : 1,'
						);
					} else if (col.aggregatorid === 'AGGR') {
						aft += ",g['" + colas + "']=" + col.expression.toJS('g', -1);
						return '';
					} else if (col.aggregatorid === 'REDUCE') {
						//					query.removeKeys.push('_REDUCE_'+colas);
						query.aggrKeys.push(col);

						//					return "'"+colas+'\':alasql.aggr[\''+col.funcid+'\']('+colexp+',undefined,(acc={}),1),'
						//					+'\'__REDUCE__'+colas+'\':acc,';
						return "'" + colas + "':alasql.aggr['" + col.funcid + "'](" + colexp + ',undefined,1),';
					}
					return '';
				}

				return '';
			})
			.join('');

		/*/*
		// columnid:r.columnid
	//	var srg = [];//rg.map(function(fn){ return (fn+':'+fn); });

	//	var srg = this.group.map(function(col){
	//		if(col == '') return '';
	//		else return col.columnid+':'+col.toJS('r','');
	//	});

	// Initializw aggregators

	/*
		this.columns.forEach(function(col){
	//		console.log(f);
	//			if(f.constructor.name == 'LiteralValue') return '';


			if (col instanceof yy.AggrValue) {
				if (col.aggregatorid == 'SUM') { srg.push("'"+col.as+'\':0'); }//f.field.arguments[0].toJS();
				else if(col.aggregatorid == 'COUNT') {srg.push( "'"+col.as+'\':0'); }
				else if(col.aggregatorid == 'MIN') { srg.push( "'"+col.as+'\':Infinity'); }
				else if(col.aggregatorid == 'MAX') { srg.push( "'"+col.as+'\':-Infinity'); }
	//			else if(col.aggregatorid == 'AVG') { srg.push(col.as+':0'); }
	//				return 'group.'+f.name.value+'=+(+group.'+f.name.value+'||0)+'+f.field.arguments[0].toJS('rec','')+';'; //f.field.arguments[0].toJS();
			};

		});



	/***************** /

	//	s += srg.join(',');

		// var ss = [];
		// gff.forEach(function(fn){
		// 	ss.push(fn+':rec.'+fn);
		// });
		// s += ss.join(',');
	//	s += '});};';
*/
		s += '}' + aft + ',g));' + aft2 + '} else {';

		//	console.log(s, this.columns);

		//		s += self.columns.map(function(col){
		s += query.selectGroup
			.map(function (col) {
				var colas = col.nick;
				/*/*
			// if(typeof colas == 'undefined') {
			// 	if(col instanceof yy.Column) colas = col.columnid;
			// 	else colas = col.toString();
			// }
*/
				var colexp = col.expression.toJS('p', tableid, defcols);
				let colExpIfFunIdExists = expression => {
					let colexpression = expression.args[0];
					return colexpression.toJS('p', tableid, defcols);
				};
				if (col instanceof yy.AggrValue) {
					var pre = '',
						post = '';
					if (col.distinct) {
						var pre =
							'if(typeof ' +
							colexp +
							'!="undefined" && (!g[\'$$_VALUES_' +
							colas +
							"'][" +
							colexp +
							'])) {';
						var post = "g['$$_VALUES_" + colas + "'][" + colexp + ']=true;}';
					}
					if (col.aggregatorid === 'SUM') {
						if ('funcid' in col.expression) {
							let colexp1 = colExpIfFunIdExists(col.expression);
							return (
								pre +
								`if(g['${colas}'] == null && ${colexp1} == null){g['${colas}'] = null}
							else if(typeof g['${colas}']!== 'object' && typeof g['${colas}']!== 'number' && typeof ${colexp1}!== 'object' && typeof ${colexp1}!== 'number'){g['${colas}'] = null}
							else if(typeof g['${colas}']!== 'object' && typeof g['${colas}']!== 'number' && typeof ${colexp1} == 'number'){g['${colas}'] = ${colexp}}
							else if(typeof g['${colas}']!== 'number' && typeof ${colexp1}!== 'number' && typeof ${colexp1}!== 'object'){g['${colas}'] = g['${colas}']}
							else if((g['${colas}'] == null || (typeof g['${colas}']!== 'number' && typeof g['${colas}']!== 'object')) && (${colexp1} == null || (typeof ${colexp1}!== 'number' && typeof ${colexp1}!== 'object'))){g['${colas}'] = null}
							else if(typeof g['${colas}'] == 'number' && typeof ${colexp1} ==null){g['${colas}'] = g['${colas}']}
							else if(typeof g['${colas}'] == null && typeof ${colexp1} =='number'){g['${colas}'] = ${colexp}}
							else{g['${colas}'] += ${colexp}||0}` +
								post
							);
						}
						return (
							pre +
							`if(g['${colas}'] == null && ${colexp} == null){g['${colas}'] = null}
							 else if(typeof g['${colas}']!== 'object' && typeof g['${colas}']!== 'number'&& typeof ${colexp}!== 'object' && typeof ${colexp}!== 'number'){g['${colas}'] = null}
							 else if(typeof g['${colas}']!== 'object' && typeof g['${colas}']!== 'number' && typeof ${colexp} == 'number'){g['${colas}'] = ${colexp}}
							 else if(typeof g['${colas}']!== 'number' && typeof ${colexp}!== 'number' && typeof ${colexp}!== 'object'){g['${colas}'] = g['${colas}']}
							 else if((g['${colas}'] == null || (typeof g['${colas}']!== 'number' && typeof g['${colas}']!== 'object')) && (${colexp} == null || (typeof ${colexp}!== 'number' && typeof ${colexp}!== 'object'))){g['${colas}'] = null}
							 else if(typeof g['${colas}'] == 'number' && typeof ${colexp} ==null){g['${colas}'] = g['${colas}']}
							 else if(typeof g['${colas}'] == null && typeof ${colexp} =='number'){g['${colas}'] = ${colexp}}
							 else{g['${colas}'] += ${colexp}||0}` +
							post
						);
					} else if (col.aggregatorid === 'TOTAL') {
						if ('funcid' in col.expression) {
							let colexp1 = colExpIfFunIdExists(col.expression);
							return (
								pre +
								`if(typeof g['${colas}'] == 'string' && !isNaN(g['${colas}']) && typeof Number(g['${colas}']) == 'number' &&
						typeof ${colexp1} == 'string' && !isNaN(${colexp1}) && typeof Number(${colexp1}) == 'number'){g['${colas}'] = Number(g['${colas}']) + Number(${colexp1})}
						else if(typeof g['${colas}'] == 'string' && typeof ${colexp1} == 'string'){g['${colas}'] = 0}
						else if(typeof g['${colas}'] == 'string' && typeof ${colexp1} == 'number'){g['${colas}'] = ${colexp1}}
						else if(typeof ${colexp1} == 'string' && typeof g['${colas}'] == 'number'){g['${colas}'] = g['${colas}']}
						else{g['${colas}'] += ${colexp1}||0}` +
								post
							);
						}
						return (
							pre +
							`if(typeof g['${colas}'] == 'string' && !isNaN(g['${colas}']) && typeof Number(g['${colas}']) == 'number' &&
						typeof ${colexp} == 'string' && !isNaN(${colexp}) && typeof Number(${colexp}) == 'number'){g['${colas}'] = Number(g['${colas}']) + Number(${colexp})}
						else if(typeof g['${colas}'] == 'string' && typeof ${colexp} == 'string'){g['${colas}'] = 0}
						else if(typeof g['${colas}'] == 'string' && typeof ${colexp} == 'number'){g['${colas}'] = ${colexp}}
						else if(typeof ${colexp} == 'string' && typeof g['${colas}'] == 'number'){g['${colas}'] = g['${colas}']}
						else{g['${colas}'] += ${colexp}||0}` +
							post
						);
					} else if (col.aggregatorid === 'COUNT') {
						//					console.log(221,col.expression.columnid == '*');
						if (col.expression.columnid === '*') {
							return pre + "g['" + colas + "']++;" + post;
						} else {
							return (
								pre +
								'if(typeof ' +
								colexp +
								'!="undefined" && ' +
								colexp +
								" !== null) g['" +
								colas +
								"']++;" +
								post
							);
						}
					} else if (col.aggregatorid === 'ARRAY') {
						return pre + "g['" + colas + "'].push(" + colexp + ');' + post;
					} else if (col.aggregatorid === 'MIN') {
						if ('funcid' in col.expression) {
							let colexp1 = colExpIfFunIdExists(col.expression);
							//console.log(pre + 'if ((y=' + colexp + ") < g['" + colas + "']) g['" + colas + "'])
							return(
								pre +
								`if((g['${colas}'] == null && ${colexp1}!== null) ? y = ${colexp} : (g['${colas}']!== null &&
							${colexp1} == null) ? y = g['${colas}']:((y=${colexp}) < g['${colas}'])){ if(typeof y == 'number')
							{g['${colas}'] = y;}else if(typeof y == 'object' && y instanceof Date){g['${colas}'] = y;}
							else if(typeof y == 'object' && typeof Number(y) == 'number'){g['${colas}'] = Number(y);}}
							else if(g['${colas}']!== null && typeof g['${colas}'] == 'object' && y instanceof Date){g['${colas}'] = g['${colas}']}
							else if(g['${colas}']!== null && typeof g['${colas}'] == 'object'){g['${colas}'] = Number(g['${colas}'])}` +
								post
							);
						}
						return (
							pre +
							`if((g['${colas}'] == null && ${colexp}!== null) ? y = ${colexp} : (g['${colas}']!== null &&
							${colexp} == null) ? y = g['${colas}']:((y=${colexp}) < g['${colas}'])){ if(typeof y == 'number')
							{g['${colas}'] = y;}else if(typeof y == 'object' && y instanceof Date){g['${colas}'] = y;}
							else if(typeof y == 'object' && typeof Number(y) == 'number'){g['${colas}'] = Number(y);}}
							else if(g['${colas}']!== null && typeof g['${colas}'] == 'object' && y instanceof Date){g['${colas}'] = g['${colas}']}
							else if(g['${colas}']!== null && typeof g['${colas}'] == 'object'){g['${colas}'] = Number(g['${colas}'])}` +
							post
						);
					} else if (col.aggregatorid === 'MAX') {
						if ('funcid' in col.expression) {
							let colexp1 = colExpIfFunIdExists(col.expression);
							//console.log(pre + 'if ((y=' + colexp + ") > g['" + colas + "']) g['" + colas + "'])
							return(
								pre +
								`if((g['${colas}'] == null && ${colexp1}!== null) ? y = ${colexp} : (g['${colas}']!== null &&
							${colexp1} == null) ? y = g['${colas}']:((y=${colexp}) > g['${colas}'])){ if(typeof y == 'number')
							{g['${colas}'] = y;}else if(typeof y == 'object' && y instanceof Date){g['${colas}'] = y;}
							else if(typeof y == 'object' && typeof Number(y) == 'number'){g['${colas}'] = Number(y);}}
							else if(g['${colas}']!== null && typeof g['${colas}'] == 'object' && y instanceof Date){g['${colas}'] = g['${colas}']}
							else if(g['${colas}']!== null && typeof g['${colas}'] == 'object'){g['${colas}'] = Number(g['${colas}'])}` +
								post
							);
						}
						return (
							pre +
							`if((g['${colas}'] == null && ${colexp}!== null) ? y = ${colexp} : (g['${colas}']!== null &&
							${colexp} == null) ? y = g['${colas}']:((y=${colexp}) > g['${colas}'])){ if(typeof y == 'number')
							{g['${colas}'] = y;}else if(typeof y == 'object' && y instanceof Date){g['${colas}'] = y;}
							else if(typeof y == 'object' && typeof Number(y) == 'number'){g['${colas}'] = Number(y);}}
							else if(g['${colas}']!== null && typeof g['${colas}'] == 'object' && y instanceof Date){g['${colas}'] = g['${colas}']}
							else if(g['${colas}']!== null && typeof g['${colas}'] == 'object'){g['${colas}'] = Number(g['${colas}'])}` +
							post
						);
					} else if (col.aggregatorid === 'FIRST') {
						return '';
					} else if (col.aggregatorid === 'LAST') {
						return pre + "g['" + colas + "']=" + colexp + ';' + post;
					} else if (col.aggregatorid === 'AVG') {
						return (
							'' +
							pre +
							"g['_SUM_" +
							colas +
							"']+=(y=" +
							colexp +
							')||0;' +
							"g['_COUNT_" +
							colas +
							'\']+=(typeof y == "undefined" || y === null) ? 0 : 1;' +
							"g['" +
							colas +
							"']=g['_SUM_" +
							colas +
							"']/g['_COUNT_" +
							colas +
							"'];" +
							post
						);
						//					 }
						//			else if(col.aggregatorid == 'AVG') { srg.push(colas+':0'); }
					} else if (col.aggregatorid === 'AGGR') {
						return '' + pre + "g['" + colas + "']=" + col.expression.toJS('g', -1) + ';' + post;
					} else if (col.aggregatorid === 'REDUCE') {
						return (
							'' +
							pre +
							"g['" +
							colas +
							"']=alasql.aggr." +
							col.funcid +
							'(' +
							colexp +
							",g['" +
							colas +
							"'],2);" +
							post
						);
					}

					return '';
				}

				return '';
			})
			.join('');

		//		s += selectFields.map(function(f){
		//			console.log(f);
		//			if(f.constructor.name == 'LiteralValue') return '';
		//			if (f.field instanceof SQLParser.nodes.FunctionValue
		//				&& (f.field.name.toUpperCase() == 'SUM' || f.field.name.toUpperCase() == 'COUNT')) {
		//				return 'group.'+f.name.value+'=+(+group.'+f.name.value+'||0)+'+f.field.arguments[0].toJS('rec','')+';'; //f.field.arguments[0].toJS();
		//				return 'group.'+f.name.value+'+='+f.field.arguments[0].toJS('rec','')+';'; //f.field.arguments[0].toJS();
		//				return 'group.'+f.name.value+'+=rec.'+f.name.value+';'; //f.field.arguments[0].toJS();
		//			};
		//			return '';
		//		}).join('');

		//		s += '	group.amt += rec.emplid;';
		//		s += 'group.count++;';
		//console.log(JSON.stringify(s));
		s += '}';
	});

	//		console.log('groupfn',s);
	return new Function('p,params,alasql', 'var y;' + s);
};
