/* 
    通用闭环 v 0.1.0 czy 2023/4/6
    包括：普通闭环类型、用药闭环、用药闭环按年份月份天分组的版本、可并行分支闭环、输血闭环
    普通类型闭环：
        只有一条横向主轴的闭环，可能会有危急值，主轴节点和危急值节点可配置字典并显示所有节点，显示所有的节点时可能会有取消类节点，
        取消类节点有才显示，医嘱可以增加开单节点
    用药闭环：
        有一条纵向主轴以日期为主线列有该天执行的医嘱，每条医嘱可使用普通类型闭环（项目上有在最后增加某个节点的情况）
    用药闭环按年份月份天分组的版本：
        年月日横向分组，在框里有每天的医嘱，一般简单闭环
    可并行分支闭环：
        会有总分等形式，情况较多
    输血闭环：
        横向分支还会纵向分支
*/

/* AllLoop通用闭环 */
/* 请求，展示，字典，危急值，排序 */
function AllLoop(param) {
    this.defaultOpt = this.getDefaultOpt();
    this.parameter = this.mergeParam(param);
    this.init();
}

AllLoop.prototype = {
    constructor: AllLoop,
    getDefaultOpt: function() {
        return {
            firstReq: {
                /* （***测试相关***） */
                testData: null, // 测试数据
                /* （---测试相关---） */
                /* ***请求相关*** */
                action: 'MES0018',
                systemCode: '', // 系统代码
                params: [], // 参数请求数据
                dictParams: {} // 请求字典参数
                /* ---请求相关--- */
            },
            secondReq: {
                testData: null,
                flag: false, // 是否二次请求
                containFirst: true, //是否使用第一次请求的数据作为分支数据
                action: '',
                systemCode: '',
                params: [],
                dictParams: {}
            },
            dict: null, // 字典
            cvDict: null, // 危急值字典
            /* ***展示相关*** */
            selector: '', // 选择器，挂在哪个节点上
            tableId: '', // 用来调整挂在datagrid表里时，datagrid的样式
            index: '', // 用来调整datagrid里哪一行
            showFullNode: false, //是否展示完整的节点
            showFullCvNode: false, //是否展示完整的危急值节点
            filterDuplicateNode: true, //是否过滤重复的节点
            foldDuplicateNode: true, //是否折叠重复的节点
            isFilterAsDict: true, //是否按照字典过滤数据
            direction: '', // 方向，row colum
            timeTables: '', // 时间表,['year', 'month']
            groupField: '', // 默认 'esExamId'，纵向时间
            rowData: '', // 额外增加的数据
            isMainWhenVShow: true, // 纵向展示是否有主节点
            timeTableShowCount: true,
			notEmpty: false, //不清空
            /* ---展示相关--- */
            useOldLoop: false, //是否使用旧的闭环
            oldLoopParam: {} //旧的闭环的参数
        };
    },
    mergeParam: function(o) {
        // 合并参数
        var param = this.defaultOpt;
        for (var k in o) {
            if (['firstReq', 'secondReq'].indexOf(k) > -1) {
                var ino = o[k];  //对象替换更深一层
                for (var ink in ino) {
                    param[k][ink] = ino[ink];
                }
            } else {
                param[k] = o[k];
            }
        }
        return param;
    },
    getData: function(o, callback) {
        var that = this;
        if (o.testData) return callback.bind(this, o.testData.data)();
        var params = o.params;
        var action = o.action || 'MES0018';
        var postParams;
    
        if (action === 'MES0010') {
            postParams = {
                data: {
                    ordExecInfo: {
                        hdcOrdId: params[0]
                    }
                }
            };
        }
        if (action === 'MES0018') {
            postParams = {
                data: {
                    ensStatusLogInfo: {
                        ensLogId: params[0],
                        ensSystemCode: params[1]
                    }
                }
            };
        }
        if (!window.commomAjax && window.commomAjaxAsyncRest) window.commomAjax = window.commomAjaxAsyncRest;
        var res = commomAjax(
            o.url || MS_HDCURL,
            {
                action: action,
                page: 1,
                rows: 1000,
                params: JSON.stringify(postParams)
            },
            '',
            '',
            callback
                ? function (res) {
                    if (res && 'data' in res) {
                        callback.bind(that, res.data)();
                    }
                }
                : ''
        );
        //console.log('res:',res);
        if (res && 'data' in res) return res.data;
        else return [];
    },
    init: function() {
        var parameter = this.parameter;
        var firstReq = parameter.firstReq;
        this.getData(firstReq, function(data) {
            var html = window.EMR_Init_nullData || '<h3>加载中...<h3>';
			if (!parameter.connectObj || !parameter.connectObj.html) C(parameter.selector).empty().append(html);
            var timeTables = parameter.timeTables;
            var direction = parameter.direction;    
            var adpParam = getAdpParam();
            var param = new DataAdapter(adpParam).param;
            var typeCode = 0;
            if (timeTables) {
                typeCode = 1;
                html = new YearCon(param)._html;
            } else if (direction === 'column') {
                typeCode = 2;
                html = new ColumnAxis(param)._html;
            } else {
                typeCode = 3;
                html = new RowAxis(param)._html;
            }
            this.typeCode = typeCode;
            if (data.length && html) {
				if (parameter.connectObj) {
					var connectObj = parameter.connectObj;
					if (connectObj.html) {
						if (parameter.sequence > connectObj.sequence) {
							html = connectObj.html + html;
						} else {
							html = html + connectObj.html;
						}
					}
					connectObj.html = html;
					connectObj.sequence = parameter.sequence;
				}
				C(parameter.selector).empty().append(html);
				this.adjustStyle(typeCode); //里面包含宽度调整
				this.addEvent(typeCode);
			}

            function getAdpParam() {
                var o = {};
                for (var k in parameter) {
                    o[k] = parameter[k];
                }
                o.data = data;
                o.flag = parameter.secondReq && parameter.secondReq.flag;
                return o;
            }
        });
    },
    setWidth: function(num) {
        var typeCode = this.typeCode;
        var parameter = this.parameter, selector = parameter.selector;
        var container = C(selector);
        var dom_c = container._eles[0];
        var width = dom_c && dom_c.offsetWidth || 0;
        if (width && num) {
            width += num;
            return container.setStyle('width', width + 'px');
        }
        if (typeCode === 3) {
            container.setStyle('width', '9999px');
            var sections = C(selector).find('.loop-row-section')._eles;
            var w = 0;
            for (var i = 0; i < sections.length; i++) {
                w += sections[i].offsetWidth + 1;
            }
			if (parameter.connectObj) {
				if (parameter.connectObj.w) w = Math.max(parameter.w, w); 
				else parameter.connectObj.w = w; //保证总是去最大的容器宽度。
			}
            container.setStyle('width', w + 'px');
        } else if (typeCode === 2) {
            container.setStyle('width', '9999px');
            var sections = C(selector).find('.loop-all-line')._eles;
            if (!sections) return;
            var w = 0;
            for (var i = 0; i < sections.length; i++) {
                w = Math.max(w, sections[i].offsetWidth + 1);
            }
			if (parameter.connectObj) {
				if (parameter.connectObj.w) w = Math.max(parameter.connectObj.w, w); 
				else parameter.connectObj.w = w; //保证总是去最大的容器宽度。
			}
            container.setStyle('width', (w + 400) + 'px');
        } else {
            container.setStyle('width', '9999px');
            var years = C(selector).find('.year-con-year')._eles;
            var w = 0;
            for (var i = 0; i < years.length; i++) {
                w += years[i].offsetWidth;
            }
            container.setStyle('width', w + 'px');
        }
        
        // 调整完成，改变表格内容的宽度
        if (window.$) {
			var w = $(selector).width();
			setTimeout(function(){	
				if ($.fn.datagrid) {
					//解决自适应表格闭环过长内容不完整
					if (parameter.tableId) {
						var thisTable = $(parameter.tableId);
						var tableW = thisTable.prev().width();
						var detail = thisTable.datagrid('getRowDetail', parameter.index);
						detail.width(tableW);
					}
					parameter.tableId ? $(parameter.tableId).datagrid('fixDetailRowHeight', parameter.index) : ''; //easyui固定明细行的高度。
				}
			}, 0);
        }
    },
    adjustStyle: function(type) {
        var parameter = this.parameter, selector = parameter.selector;
        this.setWidth();
        if (type === 3) {
			if (parameter.connectObj) return; //有这个就不调整
            var h = C(selector)._eles[0].offsetHeight;
            var sections = C(selector).find('.loop-row-section')._eles;
            /* 纵向高度处理包含危急值 */
            var max_maxVlineLength = 0;
            for (var i = 0; i < sections.length; i++) {
                var maxVlineLength = sections[i].getAttribute('maxVlineLength');
                max_maxVlineLength = Math.max(max_maxVlineLength, maxVlineLength);
            }
            max_vLineheight = max_maxVlineLength * 80; //顶部最高危急值高度
            h -= max_vLineheight;
            for (var i = 0; i < sections.length; i++) {
                var maxVlineLength = sections[i].getAttribute('maxVlineLength');
                var sectionHeight = sections[i].offsetHeight;
                var topVlineHeight = maxVlineLength * 80;
                var vLineDiff = max_vLineheight - topVlineHeight; //本部分顶部危急值与最大顶部危急值差异
                var sectionHeightWithoutTopVline = sectionHeight - topVlineHeight;
                sections[i].style.marginTop = ((h - sectionHeightWithoutTopVline) / 2 + vLineDiff)+ 'px';
            }
        } else if (type === 2) {
            var vRoot = C(selector).find('.loop-column-axis');
            if (!!window.ActiveXObject || 'ActiveXObject' in window) vRoot.setStyle('margin-left', '0px');
        }
    },
    addEvent: function(type) {
        var _this = this;
        var parameter = this.parameter, selector = parameter.selector;
        var btns = C(selector).find('.loop-step-flat-fold-btn');
        btns.on('click', function() {
            var par = C(this).parent();
            var step = C(par).parent();
            var tar = par.prev();
            var isShow = tar.hasClass('showing');
            if (isShow) {
                C(this).html('+');
                step.removeClass('showing');
                tar.removeClass('showing');
                // tar.addClass('hidding');
                _this.setWidth();
            } else {
                C(this).html('-');
                step.addClass('showing');
                tar.addClass('showing');
                // tar.removeClass('hidding');
                _this.setWidth();
            }
        });
    }
}

/* 
    数据适配器，变动的都是数据 
*/
function DataAdapter(o) {
    if (o.dict) o.dict = this.dictFn.trans.call(this, o.dict);
    this.o = o;
    this.dealedData = this.handleData.index.call(this, {
		field: o.firstReq.action === 'MES0010' ? this.field2 : this.field,
		notFilter: o.firstReq.action === 'MES0010' ? true : false
	});
    this.param = this.getParam();
}
DataAdapter.prototype = {
    constructor: DataAdapter,
    field: {
        esSystemCode: 'syscode',
        esStatusCode: 'code',
        esStatusDesc: 'desc',
        esOperatorName: 'name',
        esOperateDate: 'date',
        esOperateTime: 'time'
    },
    field2: {
        ordExecUserName: 'name',
        ordExecStatusDesc: 'desc',
        ordExecStatusCode: 'code',
        ensLogId: 'logId',
        flag: 'flag',
        ordExecDate: 'date',
        ordExecTime: 'time',
        ordRevExecDate: 'stopDate',
        ordRevExecTime: 'stopTime'
    },
    dictField: {
        'isBranch': 'isBranch',
        'branches': 'branches',
        'closedCycleCode': 'code',
        'closedCycleName': 'name',
        'isHasAdd': 'isHasAdd' //有才加
    },
    getData: AllLoop.prototype.getData.bind(this),
    handleData: {
        index: function(obj) {
            var isSec = obj && obj.isSec; //默认传参就是第二次请求的数据处理
            var data = obj && obj.data || '';
            var field = obj && obj.field || '';
            var firstItem = obj && obj.firstItem;
            var o = this.o, 
                rowData = o.rowData,
                filterDuplicateNode = o.filterDuplicateNode,
                flag = o.flag; //flag存在表示会有二次请求
            /* 字段转换 */
            data = this.handleData.trans.call(this, o, data, field);
            if (!data.length) return data; // 空数据直接返回
            if (firstItem) data.push(firstItem); //第二次请求的数据处理，可以加入第一次的数据
            /* 排序 */
            this.handleData.sort.call(this, data);
            /* 过滤重复的节点，加到对应的节点数据上 */
            if (filterDuplicateNode && !obj.notFilter) data = this.handleData.filter.call(this, data); 
            /* 过滤之后是要使用的节点 */
            /* 增加一行 */
            if (rowData) {
                var isAddRowData = flag && isSec || !flag;
                if (isAddRowData) this.handleData.addRowData.call(this, data, rowData);
            }
            /* 过滤危急值节点加到对应的节点数据上 */
            this.handleData.getCvData.call(this, data);
            
            this.handleData.reOrderIndex.call(this, data);
            return data;
        },
        trans: function(o, data, field) {
            data = data || o.data, field = field || o.field || this.field;
            var groupField = o.groupField;
            // field = field || o.selField2 ? this.field2 : this.field;
            if (groupField) field[groupField] = 'groupId';
            return data.map(function(itm, i) {
                var o = getDefaultObj();
                for (var k in field) {
                    o[field[k]] = itm[k] || '';
                }
                o.index = i + 1;
                return o;
            });
            function getDefaultObj() {
                return {
                    cls: '',
                    stepNum: '',
                    desc: '-',
                    date: '-',
                    time: '-',
                    isLack: ''
                };
            }
        },
        sort: function(data) {
            var o = this.o;
            /* 排序前记录原始在数据中的顺序 */
            data.forEach(function(itm, ind) {itm.indexInRaw = ind});
            // 基础时间
            data.sort(function(a, b){
                var atime = a.date + ' ' + a.time, btime = b.date + ' ' + b.time;
                if (!atime || !btime) return 0;
                var result = tool_czy.diffTime(atime, btime);
                return result;
            });
    
            return data;
        },
        filter: function(data) {
            var o = this.o, dict = o.dict, groupField = o.groupField, timeTables = o.timeTables;
            var ndata = [], dup_datas = [];
            var dict_isBranch_flags = [];
            if (dict) dict_isBranch_flags = dict
                .map(function(itm) {return itm.isBranch;})
                .filter(function(itm) {return itm;});
            for (var i = data.length - 1; i >= 0; i--) {
                var itm = data[i];
                var extraConditoinKey = timeTables ? 'date' :
                    !dict && groupField? 'groupId' : 
                    dict_isBranch_flags.length && groupField ? 'groupId' : 
                    o.direction === 'column' ? 'date' : '';
                /* 代表数据会按照groupId分支 */
                var dupData_in_ndata = ndata
                    .filter(function(ndataitm) { 
                        var constflag = ndataitm.desc === itm.desc;
                        var flag = extraConditoinKey ? 
                            constflag && ndataitm[extraConditoinKey] === itm[extraConditoinKey] :
                            constflag;
                        return flag; 
                    });
                if (!dupData_in_ndata.length) ndata.push(itm); //取第一个，倒着取
                else {
                    var usedItem = dupData_in_ndata[0]; //取ndata里的重复数据，附上重复信息
                    dup_datas.unshift(itm);
                    usedItem.dupDatas && usedItem.dupDatas.unshift(itm) || (usedItem.dupDatas = [itm]);
                }
            }
            ndata.reverse();
            if (dup_datas.length) {
                dup_datas.forEach(function(itm) {
                    console.log('重复数据:', itm, '在数据中的位置:', itm.indexInRaw);
                });
            }
            return ndata;
        },
        addRowData: function(data, rowData) {
            var o = this.o, dict = o.dict;
            var posiInd = !isNaN(rowData.step - 1) ? rowData.step - 1 : 0;
            data.splice(posiInd, 0, rowData);
            rowData.isRowData = true;
            /* step标记加入的数据的位置，字典对应位置加入 */
            if (dict) {
                dict.splice(posiInd, 0, {
                    'isBranch': rowData.isBranch,
                    'code': rowData.code,
                    'name': rowData.desc
                });
            }
        },
        getCvData: function(data) {
            var _this = this;
            var o = this.o, groupField = o.groupField, dict = o.dict;
            var ndataO = {}, ndata = [], cvData = [];
            if (!dict) return;
            dict.forEach(function(itm) { 
                var branches = itm.branches;
                var code = itm.code;
                var branchGroup = {};
                if (branches) {
                    var isCv = branches[0] && branches[0].isCv;
                    var branches_code = branches.map(function(itm) {
                        return itm.code; 
                    });
                    var belongData = null; //分支归属的数据
                    for (var i = 0 ; i < data.length; i++) {
                        if (data[i].code === code) {
                            belongData = data[i];
                            data[i].dict = branches;
                            if (code in ndataO) ndataO[code].push(data[i]);
                            else ndataO[code] = [ data[i] ];
                        }
                        if (branches_code.indexOf(data[i].code) > -1) {
                            var resItm = data.splice(i, 1)[0];
                            resItm.beloneCode = code;
                            if (isCv) resItm.cls = 'loop-step-cvItem';
                            else resItm.cls = 'loop-step-vline';
                            var groupId = resItm.groupId || '';
                            branchGroup[groupId] = 1;
                            cvData.push(resItm);
                            i--;
                        }
                    }
                    // 没有分支归属的数据增加
                    if (!belongData && o.direction != 'column') {
                        ndataO[code] = [];
                        for (var k in branchGroup) {
                            var addO = {
                                code: code,
                                desc: itm.name,
                                cls: isCv ? 'loop-step-cvRoot' : '',
                                groupId: k,
                                dict: branches,
                                name: '',
                                date: '',
                                time: ''
                            };
                            ndataO[code].push(addO);
                            data.push(addO);
                        }
                    }
                }
            });
            if (o.direction === 'column') return;
            for (var k in ndataO) {
                ndataO[k].forEach(function(dataitm) {
                    var dict = dataitm.dict, showFullNode = o.showFullNode;
                    if (groupField) {
                        dataitm.cvs = cvData.filter(function(cvitm) { 
                            return cvitm.beloneCode === k && cvitm.groupId === dataitm.groupId;
                        });
                    } else {
                        dataitm.cvs = cvData.filter(function(cvitm) { 
                            return cvitm.beloneCode === k;
                        });
                    }
                    _this.handleData.reOrderIndex(dataitm.cvs);
                    if (dict && dataitm.cvs.length) {
                        var dupDict = dict.slice();
                        dupDict.reverse();
                        var dealedByDictObj = _this.dictFn.dealWithDict.call(_this, dupDict, dataitm.cvs);
                        if (showFullNode) {
                            dataitm.cvs = dealedByDictObj.full;
                        } else {
                            dataitm.cvs = dealedByDictObj.data;
                        }
                    }
                });
            }
        },
        reOrderIndex: function(data) {
            data.forEach(function(itm, ind) {itm.index = ind + 1;});
        }
    },
    dictFn: {
        trans: function(dict) {
            var df = this.dictField;
            return dict.map(function(itm) {
                var o = {};
                for (var k in df) {
                    o[df[k]] = itm[k]; 
                }
                return o;
            });
        },
        getClassifyDict: function(dict) {
            var classify_dict = [];
            var o = {
                isBranch: dict[0].isBranch,
                dict: [dict[0]]
            };
            for (var i = 1; i < dict.length; i++) {
                if (dict[i].isBranch == o.isBranch) o.dict.push(dict[i])
                else {
                    classify_dict.push(o);
                    o = {
                        isBranch: dict[i].isBranch,
                        dict: [dict[i]]
                    }
                }
                if (i === dict.length - 1) {
                    classify_dict.push(o);
                }
            }
            return classify_dict;
        },
        getClassifyDataByDict: function(classify_dict, data) {
            var o = this.o;
            var showFullNode = o.showFullNode;
            var classify_data_by_dict = [];
            var datas_not_in_dict = [];
            var group = {};
            var offnum = 0;
            for (var i = 0; i < classify_dict.length; i++) {
                var classify_dict_itm = classify_dict[i], 
                    isBranch = classify_dict_itm.isBranch,
                    dict = classify_dict_itm.dict;
                var group_arr = [];
                if (isBranch) {
                    var remain_group_datas = data.filter(function(dataitm){
                        var flag = dict.map(function(dictitm){ return dictitm['code']; }).indexOf(dataitm.code) > -1;
                        if (flag) dataitm.isInDict = true;
                        return flag;
                    });
                    remain_group_datas.forEach(function(dataitm) {
                        var groupId = dataitm.groupId || '';
                        if (groupId in group) group[groupId].push(dataitm);
                        else {
                            group[groupId] = [dataitm]
                        }
                    });
                    if (!remain_group_datas.length && showFullNode) group[''] = []; //空数据展示完整节点也要加
                    for (var k in group) {
                        var branch_data = group[k];
                        var dealedByDictObj = this.dictFn.dealWithDict.call(this, dict, branch_data, offnum);
                        branch_data = showFullNode ? dealedByDictObj.full : dealedByDictObj.data;
                        group_arr.push(branch_data);
                    }
                    group = {};
                    if (group_arr.length) classify_data_by_dict.push(group_arr);
                } else {
                    var branch_data = data.filter(function(dataitm){
                        var flag = dict.map(function(dictitm){ return dictitm['code']; }).indexOf(dataitm.code) > -1;
                        if (flag) dataitm.isInDict = true;
                        return flag;
                    });
                    var dealedByDictObj = this.dictFn.dealWithDict.call(this, dict, branch_data, offnum);
                    branch_data = showFullNode ? dealedByDictObj.full : dealedByDictObj.data;
                    group_arr.push(branch_data);
                    if (branch_data.length) classify_data_by_dict.push(group_arr);
                }
                var group_arr_max_length = 0;
                group_arr.forEach(function(itm) { group_arr_max_length = Math.max(group_arr_max_length, itm.length)});
                offnum += group_arr_max_length;
            }
            datas_not_in_dict = data.filter(function(itm, ind) { 
                var flag = !itm.isInDict;
                if (flag) itm.indexInRaw = ind;
                return flag; 
            });
            if (datas_not_in_dict.length) {
                console.log('字典：', o.dict);
                datas_not_in_dict.forEach(function(itm) {
                    console.log('不在字典中的数据：', itm, 'code:' + itm.code, '在数据中第', itm.indexInRaw, '行');
                });
            }
            return classify_data_by_dict;
        },
        dealWithDict: function(dict, data, offnum) {
            var o = this.o, isFilterAsDict = o.isFilterAsDict, showFullNode = o.showFullNode;
            var isCv = dict[0] && dict[0].isCv;
            var isV = data[0] && data[0].cls === 'loop-step-vline';
            var dict_codes = [];
            var data_codes = [];
            var lack_codes = [];
            offnum = offnum || 0;
            var hasAddConnt = 0; //字典的有才加遇到了多少
            var dataHasAddCount = 0; //数据中的有才加遇到了多少
            for (var i = 0; i < dict.length; i++) {
                var dict_code = dict[i]['code'];
                dict_codes.push(dict_code);
                for (var j = 0; j < data.length; j++) {
                    var data_code = data[j]['code'];
                    if (data_codes.indexOf(data_code) === -1) data_codes.push(data_code);
                    if (dict_code === data_code) {
                        if (dict[i].isHasAdd && !dict[i].branches) dataHasAddCount++;
                        data[j].indexInDict = offnum + i + 1;
                        if (showFullNode) {
                            data[j].index = hasAddConnt ?
                                data[j].indexInDict - hasAddConnt + dataHasAddCount :
                                data[j].indexInDict;
                        }
                        if (isCv || isV) data[j].index = dict.length - i;
                    }
                }
                if (dict[i].isHasAdd) hasAddConnt++;
            }
            if (isFilterAsDict) {
                data = data.filter(function(itm) { return dict_codes.indexOf(itm['code']) > -1; });
            }
            sort(data, !showFullNode);
            var fullDictData = data.slice();
            lack_codes = dict_codes.filter(function(itm) { return data_codes.indexOf(itm) === -1; });
            if (lack_codes.length) {
                hasAddConnt = 0;
                dict.forEach(function(itm, i) {
                    if (itm.isHasAdd) hasAddConnt++;
                    if (lack_codes.indexOf(itm['code']) > -1 && !itm.isHasAdd) {
                        var cls = 'loop-step-lack';
                        var indexInDict = offnum + i + 1;
                        var index = indexInDict - hasAddConnt;
                        if (isCv) {
                            cls += ' loop-step-cvItem';
                            index = dict.length - i;
                        } else if (isV) {
                            cls += ' loop-step-vline';
                            index = dict.length - i;
                        }
                        fullDictData.push({
                            cls: cls,
                            stepNum: '',
                            desc: itm['name'],
                            code: itm['code'],
                            groupId: data[0] && 'groupId' in data[0] ? data[0].groupId : '',
                            name: '',
                            date: '',
                            time: '',
                            isLack: true,
                            indexInDict: indexInDict,
                            index: index
                        })
                    }
                });
            }
            sort(fullDictData);
            return {
                data: data,
                full: fullDictData
            }
            
            function sort(data_remain_sort, isReorder) {
                data_remain_sort.sort(function(a, b) {
                    var anum = a.indexInDict || a.index, bnum = b.indexInDict || b.index;
                    return anum - bnum;
                });
                if (isReorder) {
                    data_remain_sort.forEach(function(itm, ind) {
                        var index = ind + offnum + 1;
                        if (isCv || isV) index = data_remain_sort.length - ind;
                        itm.index = index;
                    });
                }
            }
        }
    },
    getParam: function() {
        var o = this.o;
        var data = this.dealedData;
        var direction = o.direction; //方向，row column
        var timeTables = o.timeTables; //时间表,['year', 'month']
        
        if (timeTables) {
            return this.getTimeTableParam(data);
        } else if (direction === 'column') {
            return this.getColumnParam(data);
        } else {
            return this.getRowParam(data);
        }
    },
    getRowParam: function(data, dict) {
        var o = this.o;
        dict = dict || o.dict;
        var sections = handleData.call(this, data);
        
        var sections = sections.map(function(sectionitm) {
            var sectiono = {
                ll_cls: '',
                rl_cls: '',
                style: '',
                ll_style: '',
                rl_style: '',
                maxVlineLength: sectionitm.maxVlineLength || 0,
                htmls: sectionitm.map(function(lineitm, ind) {
                    var style = 'z-index: ' + (9 + sectionitm.length - ind) + ';';
                    var lineo = {
                        steps: lineitm,
                        cv: '',
                        hasCv: sectionitm.maxVlineLength ? true : false,
                        style: style
                    };
                    return lineo;
                })
            };
            return sectiono;
        });
        
        return { htmls: sections };
        function handleData(data) {
            if (dict) {
                var classify_dict = this.dictFn.getClassifyDict.call(this, dict);
                var classify_data_by_dict = this.dictFn.getClassifyDataByDict.call(this, classify_dict, data);
                data = classify_data_by_dict;
            } else {
                data = [[data]];
            }
            handleStyleOfVline(data);
            return data;
        }
        function handleStyleOfVline(data) {
            data.forEach(function(itm) {
                itm.forEach(function(branch_data, ind) {
                    var maxVlineLength = 0;
                    /* ***竖向节点样式处理*** */
                    branch_data.forEach(function(itm) { if (itm.cvs) maxVlineLength = Math.max(maxVlineLength, itm.cvs.length) ;});
                    if (maxVlineLength) {
                        if (ind === 0) itm.maxVlineLength = maxVlineLength;
                        branch_data.forEach(function(itm) { 
                            itm.style = 'margin-top: '+ (maxVlineLength * 80) +'px;';
                            if (itm.cvs && itm.cvs.length)  {
                                itm.style += ' padding-right: 50px;';
                                itm.cls += ' pd-right-50';
                            }
                        });
                    }/* ---竖向节点样式处理--- */
                });
            });
        }
    },
    getColumnParam: function(data) {
        var _this = this;
        var col_param_o = {};
        handleData.call(this, data);
        return col_param_o;

        function handleData(data) {
            var uls = [];
            /* 按照分组字段分类 */
            var o = this.o;
            var dict = o.dict; // 字典分区
            var rowData = o.rowData;
            var secondReq = o.secondReq;
            var groupField = o.groupField;
            var showFullNode = o.showFullNode;
            var needFirstLineHalf = false;
            var meetBranchInd = -1;
            var mainDict = dict && dict.filter(function(itm, ind) {
                if (itm.isBranch && meetBranchInd === -1) meetBranchInd = ind;
                return !itm.isBranch && meetBranchInd === -1; 
            });
            var branchDict = dict && dict.filter(function(itm) {return itm.isBranch; });
            col_param_o.verticleLine = getVlineParam.call(this, data, mainDict || []);
            var mainIndex = col_param_o.verticleLine.html.length;
            if (!col_param_o.verticleLine.html.length && groupField) needFirstLineHalf = true;
            // if (mainIndex && !groupField) mainIndex--;
            
            var group = {};
            if (o.flag) {
                data.filter(function(itm) {return itm.flag;}).forEach(function(item) {
                    var data_static = _this.getSecData(item, branchDict, mainIndex, rowData, showFullNode);
                    var groupValue = 'groupId' in item ? item.groupId : item.date;
                    if (group[groupValue]) group[groupValue].push(data_static);
                    else group[groupValue] = [data_static];
                });
            } else {
                // 没有二次请求说明数据里面是所有数据
                var g_data = data.filter(function(itm) {
                    var flag = branchDict 
                        && branchDict.map(function(bitm){return bitm.code;}).indexOf(itm.code) > -1;
                    if (!branchDict) flag = true;
                    return flag;
                });
				// 保证有一条灰色的数据
				if (!g_data.length && col_param_o.verticleLine.html.length) {
                    for (var i = 0; i < col_param_o.verticleLine.html.length; i++) {
                        if (col_param_o.verticleLine.html[i].cls.indexOf('loop-step-lack') > -1) {
                            g_data.push(col_param_o.verticleLine.html[i]);
                            break;
                        }
                    }
                }
                g_data.forEach(function(item, index) {
                    if (item.isRowData) return;
                    var groupValue = 'groupId' in item ? item.groupId : item.date; // 有分组字段以分组字段分组，没有分组字段以时间分组
                    if (group[groupValue]) group[groupValue].push(item);
                    else {
                        group[groupValue] = [item];
                    }
                });
                for (var k in group) {
                    var lineData = group[k];
                    if (branchDict) {
                        if (rowData) group[k].push(rowData); //分支增加额外节点
                        var dealedByDictObj = this.dictFn.dealWithDict.call(this, branchDict, group[k], mainIndex);     
                        if (showFullNode) {
                            group[k] = dealedByDictObj.full;
                        } else {
                            group[k] = dealedByDictObj.data;
                        }
                    } else {
                        if (rowData) {
                            /* 分支增加额外节点 */
                            var posiInd = !isNaN(rowData.step - 1) ? rowData.step - 1 : 0;
                            lineData.splice(posiInd, 0, rowData);
                        }
                        this.handleData.reOrderIndex(lineData); //排序
                    }
                    group[k] = [ group[k] ];
                }
            }
            var count = 0;
			var maxNode = 0;
            for (var k in group) {
                var colSection = {
                    maintitle: k,
                    maintitleDesc: '',
                    mt_style: groupField ? 'display: none;' : '',
                    lis: []
                };
                var lineDatas = group[k];
                lineDatas.forEach(function(lineData, index) {
                    var isFirstLine = count === 0;
					maxNode = Math.max(lineData.length, maxNode);
                    var firstLineHalf = isFirstLine && needFirstLineHalf;
                    colSection.lis.push({ 
                        r_style: '', 
                        r_cls: firstLineHalf ? 'half' : '',
                        subtitle: groupField ? k : '第' +(index + 1)+ '次执行', 
                        html: {
                            steps: lineData,
                            style: 'position: relative; top: -13px; left: -50px;'
                        }
                    });
                });
                if (lineDatas.length && lineDatas[0].length) uls.push(colSection);
                count++;
            }
            
            var mainDictEnd = dict && dict.filter(function(itm, ind) {
                return !itm.isBranch && meetBranchInd != -1 && ind > meetBranchInd;
            });
            col_param_o.verticleLineEnd = getVlineParam.call(this, data, mainDictEnd || [], mainIndex + maxNode);

            col_param_o.uls = uls;

            
            function getVlineParam(data, dict, index) {
                var o = this.o;
                var showFullNode = o.showFullNode;
                var isMainWhenVShow = o.isMainWhenVShow;
                var param_o = {
                    html: [],
                    style: 'margin-left: 298px;'
                };
                if (!dict.length || !isMainWhenVShow) {
                    return param_o;
                }
                var dealedByDictObj = this.dictFn.dealWithDict.call(this, dict, data, index);
                if (showFullNode) {
                    param_o.html = dealedByDictObj.full;
                } else {
                    param_o.html = dealedByDictObj.data;
                }
                
                param_o.html.forEach(function(itm) {
                    itm.cls = (itm.cls || '') + ' loop-step-vline';
                    if (itm.step) itm.index = itm.step;
                });
                
                return param_o;
            }
        }
    },
    getSecData: function(item, branchDict, mainIndex, rowData, showFullNode) {
        var o = this.o, secondReq = o.secondReq;
        var flag = parseInt(item.flag);
        var sysCode = secondReq.systemCode;
        var data_static = [];
        if (flag) {
            var data_0018 = this.getData({
                params: [item.logId, sysCode]
            });

            data_static = this.handleData.index.call(this, {
                data: data_0018,
                firstItem: secondReq.containFirst && item,
                isSec: true
            });
        } else {
            if (secondReq.containFirst) data_static.push(item);
        }
        //按照节点字典
        if (branchDict) {
            if (rowData) data_static.push(rowData); //分支增加额外节点,字典会筛选不在分支字典里的数据
            var dealedByDictObj = this.dictFn.dealWithDict.call(this, branchDict, data_static, mainIndex);     
            if (showFullNode) {
                data_static = dealedByDictObj.full;
            } else {
                data_static = dealedByDictObj.data;
            }
        }

        return data_static;
    },
    getTimeTableParam: function(data) {
        var _this = this;
        var o = this.o, flag = o.flag, dict = o.dict;
        var years = [];
        var g = {};
        handleData();
        var style = o.timeTableShowCount ? '' : 'display: none';
        g.style = style;
        return g;
        function handleData() {
            data.forEach(function(itm) {
                var year, month, day;
                var ts = itm.date.split('-');
                year = ts[0], month = ts[1], day = ts[2];
                var cur_g = g;
                [year, month, day].forEach(function(k, i) {
                    if (!k) return;
                    if (cur_g[k]) {
                        if (i === 2) handleItm(true);
                    } else {
                        if (i === 2) {
                            handleItm()
                        } else {
                            cur_g[k] = {};
                        }
                    }
                    cur_g = cur_g[k];

                    function handleItm(isPush) {
                        if (flag) {
                            var data_static = _this.getSecData(itm, dict);
                            cur_g[k].push(data_static);
                        } else {
                            if (isPush) {
                                cur_g[k][0].push(itm);
                            } else {
                                cur_g[k] = [ [itm] ];
                            }
                        }
                    }
                });
            });
        }
    }
}

function StepGenerator(param_o) {
    if (!(this instanceof StepGenerator)) return new StepGenerator(param_o);
    this.param = this.getParam(param_o);
    this.sethtml();
}
StepGenerator.prototype = {
    constructor: StepGenerator,
    tmp: {
        con: [
            // '<div class="loop-step-con">',
            '<div class="loop-step {cls}" style="{style}">',
                '<div class="float-left relative-top-25">',
                    '{dupDatas}',
                '</div>',
                '<div class="float-left step-content-main">',
                    '<div class="loop-cvLine-con" style="position: relative;">{vline}</div>',
                    '{flatFoldBtn}',
                    '<div class="seq"><b>{index}</b></div>',
                    '<span>{desc}</span>',
                    '<p>{name}</p>',
                    '<p>{date}</p>',
                    '<p>{time}</p>',
                '</div>',
            '</div>',
            // '</div>'
        ].join(''),
        vline: [
            '{cvs}'
        ].join('')
    },
    getParam: function(param) {
        var defaultParam = {
            cls: '',
            style: '',
            index: '-',
            desc: '-',
            name: '-',
            date: '-',
            time: '-',
            cvs: '',
            dupDatas: '',
            flatFoldBtn: ''
        };
        for (var k in param) {
            if (k === 'cvs') defaultParam[k] = this.geneVline(param[k]);
            else if (k === 'dupDatas') defaultParam[k] = this.geneDup(param[k], defaultParam);
            else if (defaultParam.hasOwnProperty(k)) defaultParam[k] = param[k]; 
        }
        return defaultParam;
    },
    geneVline: function(cvs) {
        if (!cvs.length) return '';
        var html = new VLineGenerator({
            html: cvs,
            style: ''
        })._html;
        return html;
    },
    geneDup: function(dupDatas, defaultParam) {
        if (!dupDatas.length) return '';
        defaultParam.flatFoldBtn = '<i class="loop-step-flat-fold-btn">+</i>';
        defaultParam.cls += ' hasDupNode';
        dupDatas.forEach(function(itm) {itm.index = '-'});
        var html = new LineGenerator({
            steps: dupDatas,
            cv: '',
            style: ''
        })._html;
        return html;
    },
    sethtml: function() {
        this._html = getHtml(this.tmp, this.param);
    },
    render: function() {
        return C(this._html)._eles;
    }
}

function VLineGenerator(param_o) {
    if (!(this instanceof VLineGenerator)) return new VLineGenerator(param_o);
    this.param = this.getParam(param_o);
    this.sethtml();
}
VLineGenerator.prototype = {
    constructor: VLineGenerator,
    tmp: {
        con: [
            '<div class="loop-vline" style="{style}">{html}</div>'
        ].join('')
    },
    getParam: function(param_o) {
        var o = {};
        for (var k in param_o) {
            if (k === 'html') {
                var htmls = param_o[k];
                var html = '';
                htmls.forEach(function(itm) { html += new StepGenerator(itm)._html; });
                o.html = html;
            } else {
                o[k] = param_o[k];
            }
        }
        return o;
    },
    sethtml: function() {
        this._html = getHtml(this.tmp, this.param);
    },
    render: function() {
        return C(this._html)._eles;
    }
}
/* 
    生成一条线，线上有几个点，Step挂在点上
*/
function LineGenerator(param_o) {
    if (!(this instanceof LineGenerator)) return new LineGenerator(param_o);
    var html = StepGenerator()._html;
    var html_cvC = StepGenerator({
        cls: 'loop-step-cvCon',
        index: '1',
        desc: '危急值',
        name: '',
        date: '',
        time: ''
    })._html;
    this.param_o = param_o || {
        steps: html + html + html_cvC
    };
    this.param = this.getParam(this.param_o);
    this.sethtml();
}
LineGenerator.prototype = {
    constructor: LineGenerator,
    tmp: {
        con: '<div class="loop-all-line" style="{style}"><div class="loop-line">{steps}</div></div>'
    },
    getParam: function(param) {
        var o = {};
        var steps = param.steps, html = '';
        for (var k in param) {
            o[k] = param[k];
        }
        for (var i = 0; i < steps.length; i++) {
            var step = steps[i];
            html += new StepGenerator(step)._html;
        }
        o.steps = html;
        return o;
    },
    sethtml: function() {
        this._html = getHtml(this.tmp, this.param);
    },
    render: function() {
        return C(this._html)._eles;
    }
}

/* 
    横向的区域，可能有多个线在里面
*/
function RowSection(param_o) {
    if (!(this instanceof RowSection)) return new RowSection(param_o);
    this.param = this.getParam(param_o);
    this.sethtml();
}
RowSection.prototype = {
    constructor: RowSection,
    tmp: {
        con: '<div class="loop-row-section" style="{style}" maxVlineLength="{maxVlineLength}">{line_s}</div>',
        leftLine: '<div class="{ll_cls}" style="{ll_style}"></div>',
        rightLine: '<div class="{rl_cls}" style="{rl_style}"></div>',
        line: '{html}'
    },
    getParam: function(param_o) {
        var o = {};
        var lines = [];
        var htmls = param_o.htmls;
        for (var k in param_o) {
            if (k != 'htmls') o[k] = param_o[k];
        }
        for (var i = 0; i < htmls.length; i++) {
            var paramOfLineGenerator = htmls[i];
            var html = new LineGenerator(paramOfLineGenerator)._html;
            lines.push(html);
        }
        o.lines = lines;
        return o;
    },
    sethtml: function() {
        this._html = getHtml(this.tmp, this.param);
    },
    render: function() {
        return C(this._html)._eles;
    }
}

/* 
    横轴生成器，会生成横向区域可以放置的区域
*/
function RowAxis(param_o) {
    if (!(this instanceof RowAxis)) return new RowAxis(param_o);
    this.param = this.getParam(param_o);
    this.sethtml();
}
RowAxis.prototype = {
    constructor: RowAxis,
    tmp: {
        con: '<div class="loop-row-axis">{section_s}</div>',
        section: '{html}'
    },
    getParam: function(param_o) {
        var arro = {
            sections: param_o.htmls.map(function(param_RowSection){
                var html = new RowSection(param_RowSection)._html;
                return html;
            })
        };
        return arro;
    },
    sethtml: function() {
        this._html = getHtml(this.tmp, this.param);
    },
    render: function() {
        return C(this._html)._eles;
    }
}

/* 
    纵轴生成器，生成一条纵轴
*/
function ColumnAxis(param_o) {
    if (!(this instanceof ColumnAxis)) return new ColumnAxis(param_o);
    this.param = this.getParam(param_o);
    this.sethtml();
}
ColumnAxis.prototype = {
    constructor: ColumnAxis,
    tmp: {
        con: [
            '<div class="loop-column-axis">',
                '{vline}',
                '{ul_s}',
				'{vlineend}',
            '</div>'
        ].join(''),
        vline: [
            '<div class="loop-verticel-line-con">',
                '{verticleLine}',
            '</div>'
        ].join(''),
		vlineend: [
            // '<div class="loop-verticel-line-con">',
                '{verticleLineEnd}',
            // '</div>'
        ].join(''),
        ul: [
            '<ul class="loop-col-items">',
                '{maintitletmp}',
                '{li_s}',
            '</ul>',
        ].join(''),
        maintitletmp: [
            '<div class="loop-col-main-title-con" style="{mt_style}">',
                '<div class="loop-col-main-l">',
                    '{maintitle}',
                '</div>',
                '<div class="loop-col-main-r">',
                    '<div class="loop-dot"></div>',
                    '<div class="loop-main-desc">{maintitleDesc}</div>',
                '</div>',
            '</div>'
        ].join(''),
        li: [
            '<li class="loop-col-item">',
                '<div class="loop-col-item-l">',
                    '<div class="loop-tip">{subtitle}</div>',
                '</div>',
                '<div class="loop-col-item-r {r_cls}" style="{r_style}">',
                    '<div class="loop-cross"></div>',
                    '<div class="loop-section-con">{html}</div>',
                '</div>',
            '</li>'
        ].join('')
    },
    getParam: function(param_o) {
        var param = {};
        param.uls = param_o.uls.map(function(itm) {
            var lis = itm.lis.map(function(htmlo) {
                htmlo.html = new LineGenerator(htmlo.html)._html;
                return htmlo;
            });
            itm.lis = lis;
            return itm;
        });
        param.verticleLine = new VLineGenerator(param_o.verticleLine)._html;
		if (param_o.verticleLineEnd.html.length) {
			param.verticleLineEnd = '<div class="loop-verticel-line-con">' + new VLineGenerator(param_o.verticleLineEnd)._html + '</div>';
		} else {
			param.verticleLineEnd = '';
		}
        return param;
    },
    sethtml: function() {
        this._html = getHtml(this.tmp, this.param);
    },
    render: function() {
        return C(this._html)._eles;
    }
}
/* 生成日期框，给老用药闭环使用 */
function YearCon(g) {
    if (!(this instanceof YearCon)) return new YearCon(g);
    this.param = this.getParam(g);
    this.sethtml();
}
YearCon.prototype = {
    constructor: YearCon,
    tmp: {
        con: '<div class="year-con-container">{year_s}</div>',
        year: '<div class="year-con-year"><div class="year-con-year-item" style="display: none;">{y}年</div>{month_s}</div>',
        month: '<div class="year-con-month"><div class="year-con-month-item">{y}年{m}月</div>{day_s}</div>',
        day: '<div class="year-con-day"><div class="year-con-day-item">{d}日</div>{indItem_s}</div>',
        indItem: '<div class="year-con-index"><div class="year-con-index-item" style="{style}">第{ind}次</div><div class="loop-box">{html}</div></div>'
    },
    getParam: function(g) {
        var years = [];
        var style = g.style;
        delete g.style;
        for (var year in g) {
            var monthO = g[year];
            var param_year = {
                y: year,
                months: []
            }
            for (var month in monthO) {
                var dayO = monthO[month];
                var param_month = {
                    y: year,
                    m: month,
                    days: []
                }
                for (var day in dayO) {
                    var datas = dayO[day];
                    var param_day = {
                        d: day,
                        indItems: []
                    }
                    datas.forEach(function(data, ind) {
                        DataAdapter.prototype.handleData.reOrderIndex(data);
                        var html = new LineGenerator({
                            steps: data,
                            style: ''
                        })._html
                        param_day.indItems.push({
                            html: html,
                            style: style || '',
                            ind: ind + 1
                        });
                    });
                    param_month.days.push(param_day);
                }
                param_year.months.push(param_month);
            }
            years.push(param_year);
        }

        return years;
    },
    sethtml: function() {
        this._html = getHtml(this.tmp, this.param);
    },
    render: function() {
        return C(html)._eles;
    }
}

function getHtml(tmp, data) {
    var html = logic_recursion_getHtml(tmp.con, data);
    
    return html;
    function logic_recursion_getHtml(curItem, data) {
        var result = curItem.match(/{[\w_]+}/g);
        if (!result) return curItem;
        for (var i = 0; i < result.length; i++) {
            var k = result[i].substring(1, result[i].length - 1);
            if ('string' === typeof data) {
                curItem = curItem.replace(new RegExp(result[i], 'g'), data);
            } else if (/_s$/.test(k)) {
                var vs = '', ink = k.substring(0, k.length - 2);
                var ndata = (ink + 's') in data ? data[ink + 's'] : data;
                for (var j = 0; j < ndata.length; j++) {
                    vs += logic_recursion_getHtml(tmp[ink], ndata[j]);
                }
                curItem = curItem.replace(new RegExp(result[i], 'g'), vs);
            } else if (k in tmp) {
                var v = 'function' === typeof tmp[k] ? tmp[k](data) : logic_recursion_getHtml(tmp[k], data);
                curItem = curItem.replace(new RegExp(result[i], 'g'), v);
            } else {
                var v = k in data ? data[k] : k + '既不在模板中也不在数据中Err';
                curItem = curItem.replace(new RegExp(result[i], 'g'), v);
            }
        }
        return curItem;
    }
}
