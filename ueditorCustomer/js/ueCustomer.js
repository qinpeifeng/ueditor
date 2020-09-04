function UeCustomerHandler(win, $) {
  function _initCommands() {
    //为元素添加百度编辑器的方法
    //增加缩进量 原生自带 indent
    //		baidu.editor.commands['incindent'] = {
    //			execCommand: function() {
    //	        },
    //	        queryCommandState: function() {
    //	        }
    //		};
    //减少缩进量
    baidu.editor.commands['decindent'] = {
      execCommand: function() {
        var pN = UE.dom.domUtils.filterNodeList(
          this.selection.getStartElementPath(),
          'p h1 h2 h3 h4 h5 h6'
        )
        var value =
          (pN && pN.style.paddingLeft && parseInt(pN.style.paddingLeft) - 2 + 'em') || '0em'
        parseInt(value) < 0 ? (value = '0em') : ''
        this.execCommand('Paragraph', 'p', {
          style: 'padding-left:' + value
        })
      },
      queryCommandState: function() {}
    }
    //行首缩进
    baidu.editor.commands['a_incindent'] = {
      execCommand: function() {
        this.execCommand('Paragraph', 'p', {
          style: 'padding-left:0em;text-indent: 2em'
        })
      },
      queryCommandState: function() {}
    }
    //行首突出
    baidu.editor.commands['a_decindent'] = {
      execCommand: function() {
        this.execCommand('Paragraph', 'p', {
          style: 'text-indent:-2em;padding-left:2em'
        })
      },
      queryCommandState: function() {}
    }
    //行首复位
    baidu.editor.commands['custom_reset'] = {
      execCommand: function() {
        this.execCommand('Paragraph', 'p', {
          style: 'text-indent:0em;padding-left:0em'
        })
      },
      queryCommandState: function() {}
    }
    //分块区段
    baidu.editor.commands['mydetails'] = {
      execCommand: function(a, b, c, d) {
        var _lang = this.getLang()
        // var parent = this.selection._bakRange.startContainer.parentNode
        var $curr = $(this.selection._bakRange.startContainer)
        var $table = $curr.parents('table')
        if ($table.length > 0) {
          alert(_lang.uecustomer.notable_insert)
          return false
        }
        //if (typeof parent.nodeName != "undefined" && parent.nodeName.toLowerCase() != "summary" && curr.nodeName.toLowerCase() != "summary") {
        //    var _html = '<details open="">'
        //    _html += '<summary>';
        //    _html += _lang.uecustomer.please_fill_title;
        //    _html += '</summary>';
        //    _html += '<p style="line-height: 1.5em; text-indent: 2em;">' + _lang.uecustomer.please_fill_content + '</p>';
        //    _html += '</details><p><br/></p>';
        //    this.execCommand('insertHtml', _html);
        //}
        var $summary = _hasAttr($curr, 'data-class', 'details-summary')
          ? $curr
          : _hasAttr($curr.parent(), 'data-class', 'details-summary')
          ? $curr.parent()
          : $curr.parents("div[data-class='details-summary']").length > 0
          ? $curr.parents("div[data-class='details-summary']")
          : null
        if ($summary == null) {
          var _html = '<div class="details-info" data-class="details-info" data-open="true" >'
          _html +=
            '<div class="details-summary" data-class="details-summary"><div class="details-ico" data-class="details-ico"></div><p>'
          _html += _lang.uecustomer.please_fill_title
          _html += '</p></div>'
          _html += '<div class="details-content" data-class="details-content">'
          _html +=
            '<p style="line-height: 1.5em; text-indent: 2em;">' +
            _lang.uecustomer.please_fill_content +
            '</p>'
          _html += '</div>'
          _html += '</div>'
          _html += '<p>'
          _html += '<br/>'
          _html += '</p>'
          this.execCommand('insertHtml', _html)
          var that = this
          setTimeout(function() {
            _ueDetails(that)
          }, 20)
        }
        return true
      },
      queryCommandState: function(a, b, c, d) {}
    }
    //实现插件的功能代码
    baidu.editor.commands['mytabs'] = {
      execCommand: function(a, b, c, d) {
        var parent = this.selection._bakRange.startContainer.parentNode
        var curr = this.selection._bakRange.startContainer
        var $curr = $(curr)
        var _delBlockArr = [
          'tab-lis-item',
          'tab-prev',
          'tab-next',
          'tab-add',
          'tabs-close',
          'tab-close'
        ]
        var _lang = this.getLang()
        for (var i = 0; i < _delBlockArr.length; i++) {
          var item = _delBlockArr[i]
          var $p = _hasAttr($curr, 'data-class', item)
            ? $curr
            : _hasAttr($curr.parent(), 'data-class', item)
            ? $curr.parent()
            : $curr.parents("span[data-class='" + item + "'],div[data-class='" + item + "']")
                .length > 0
            ? $($curr.parents("span[data-class='" + item + "'],div[data-class='" + item + "']")[0])
            : null
          if ($p != null) {
            alert(_lang.uecustomer.noinsert)
            return false
          }
        }
        var $table = $(curr).parents('table')
        if ($table.length > 0) {
          alert(_lang.uecustomer.notable_insert)
          return false
        }

        var _lang = this.getLang()
        if (
          parent != null &&
          parent.nodeName != null &&
          typeof parent.nodeName != 'undefined' &&
          parent.nodeName.toLowerCase() != 'summary' &&
          curr.nodeName.toLowerCase() != 'summary'
        ) {
          var _html = '<div class="tab-list" data-class="tab-list" data-filter="skipempty" >'
          _html += '<div class="tab-lis" data-class="tab-lis" data-filter="skipempty" >'
          _html +=
            '<div class="tab-list-inner" data-class="tab-list-inner" data-filter="skipempty" >'
          _html += '<div class="tab-ul" data-class="tab-ul" data-filter="skipempty" >'
          _html +=
            '<div class="tab-lis-wrap" data-class="tab-lis-wrap" data-filter="skipempty"  style="left: 0px;">'
          _html +=
            '<div class="tab-lis-item" data-class="tab-lis-item" data-filter="skipempty"  data-index="1" data-active="active" class="active">'
          _html += '<p>'
          _html += _lang.uecustomer.tab + '1'
          _html +=
            '</p><div class="tab-close" data-class="tab-close" data-filter="skipempty" ></div><div class="drag-handler" data-filter="skipempty"></div>'
          _html += '</div>'
          _html +=
            '<div class="tab-lis-item" data-class="tab-lis-item" data-filter="skipempty"  data-index="2" data-active="">'
          _html += '<p>'
          _html += _lang.uecustomer.tab + '2'
          _html +=
            '</p><div class="tab-close" data-class="tab-close" data-filter="skipempty" ></div><div class="drag-handler" data-filter="skipempty"></div>'
          _html += '</div>'
          _html += '</div>'
          _html +=
            '</div><div class="tab-prev" data-class="tab-prev" data-filter="skipempty" ></div><div class="tab-next" data-class="tab-next" data-filter="skipempty" ></div><div class="tab-add" data-class="tab-add" data-filter="skipempty" ></div><div class="tabs-close" data-class="tabs-close" data-filter="skipempty" ></div>'
          _html += '</div>'
          _html += '</div>'
          _html += '<div class="tab-items" data-class="tab-items" data-filter="skipempty" >'
          _html +=
            '<div class="tab-item" data-class="tab-item" data-index="1" data-filter="skipempty" data-active="active" class="active" >'
          _html += '<p>'
          _html += '<br/>'
          _html += '</p>'
          _html += '</div>'
          _html +=
            '<div class="tab-item" data-class="tab-item" data-index="2" data-filter="skipempty" >'
          _html += '<p>'
          _html += '<br/>'
          _html += '</p>'
          _html += '</div>'
          _html += '</div>'
          _html += '</div>'
          _html += '<p>'
          _html += '<br/>'
          _html += '</p>'

          this.execCommand('insertHtml', _html)
          var that = this
          setTimeout(function() {
            //var $table= $($(curr).parents("table")[0]);
            //if ($table.length > 0)
            //{
            //    $table.css({"width":"100%","table-layout":"fixed"});
            //}
            _ueTab(that)
          }, 20)
        }
        return true
      },
      queryCommandState: function(a, b, c, d) {
        //var parent = this.selection._bakRange.startContainer.parentNode;
        //console.log($(parent).html());
        //debugger
      }
    }
  }
  function _hasAttr($element, attrKey, attrValue) {
    if (typeof $element.attr(attrKey) != 'undefined') {
      if ($element.attr(attrKey) == attrValue) {
        return true
      } else if (typeof attrValue == 'undefined') {
        return true
      }
    }
    return false
  }
  function _clearSelection(win, doc) {
    if (doc.selection != null && typeof doc.selection != 'undefined') doc.selection.clear()
    else win.getSelection().removeAllRanges()
  }
  function _ueditorDrawBack(ue) {
    _ueTab(ue)
    _removeUEPastBinNode(ue) //清空影响图片高度的html

    if (ue._ueditorDrawBack) {
      return false
    }

    ue._ueditorDrawBack = true

    /*源码切换后*/
    ue.addListener('sourcemodechanged', function(editor, a, b, c) {
      _ueTab(ue)
    })
    ue.addListener('reset', function(editor) {
      _ueTab(ue)
    })

    ue.addListener('mouseup', function(a, b, c, d) {
      var _range = this.selection.getRange()
      win.$curr = $(_range.startContainer)
      win.$endCurr = $(_range.endContainer)
      /*选中tab页Start*/
      var _delBlockArr = [
        'tab-items',
        'tab-lis-item',
        'tab-prev',
        'tab-next',
        'tab-add',
        'tabs-close',
        'tab-close'
      ]
      for (var i = 0; i < _delBlockArr.length; i++) {
        var item = _delBlockArr[i]
        /*前面选中区段有过滤标签*/
        var $p = _hasAttr($curr, 'data-class', item)
          ? $curr
          : _hasAttr($curr.parent(), 'data-class', item)
          ? $curr.parent()
          : $curr.parents("span[data-class='" + item + "'],div[data-class='" + item + "']").length >
            0
          ? $($curr.parents("span[data-class='" + item + "'],div[data-class='" + item + "']")[0])
          : null
        if ($p != null) {
          /*后面是否有过滤标签*/
          $n = _hasAttr($endCurr, 'data-class', item)
            ? $endCurr
            : _hasAttr($endCurr.parent(), 'data-class', item)
            ? $endCurr.parent()
            : $endCurr.parents("span[data-class='" + item + "'],div[data-class='" + item + "']")
                .length > 0
            ? $(
                $endCurr.parents(
                  "span[data-class='" + item + "'],div[data-class='" + item + "']"
                )[0]
              )
            : null
          //有过滤标签且前后前后选取不相等去掉选中
          if ($n != null && $n[0] != $p[0]) {
            //|| $n == null)
            //_clearSelection(this.window, this.document);

            this.selection.clearRange()
          } else {
            var _range = this.selection.getRange()
            var _s = _range.startOffset
            var $item = _hasAttr($curr, 'data-class', 'tab-lis-item')
              ? $curr
              : _hasAttr($curr.parent(), 'data-class', 'tab-lis-item')
              ? $curr.parent()
              : $curr.parents("span[data-class='tab-lis-item'],div[data-class='tab-lis-item']")
                  .length > 0
              ? $(
                  $curr.parents("span[data-class='tab-lis-item'],div[data-class='tab-lis-item']")[0]
                )
              : null
            if ($item != null && $item.index() == 0 && _s == 0) {
              _range.setStartBefore($p.parents("div[data-class='tab-list']")[0])
            } else if ($n == null) {
              /*如果后面没有过滤标签，去掉选中*/
              this.selection.clearRange()
            }
          }
        } else {
          $n = _hasAttr($endCurr, 'data-class', item)
            ? $endCurr
            : _hasAttr($endCurr.parent(), 'data-class', item)
            ? $endCurr.parent()
            : $endCurr.parents("span[data-class='" + item + "'],div[data-class='" + item + "']")
                .length > 0
            ? $(
                $endCurr.parents(
                  "span[data-class='" + item + "'],div[data-class='" + item + "']"
                )[0]
              )
            : null
          /*前面没有选中标签后面有选中标签，去除选中*/
          if ($n != null) {
            //_clearSelection(this.window, this.document);
            this.selection.clearRange()
          }
        }
      }
      /*选中tab页End*/
      /**********************************************************************************************************/
      /*选中区段Start*/
      //var _range = this.selection.getRange();
      //$curr = $(_range.startContainer);
      //$endCurr = $(_range.endContainer);
      $p =
        $curr[0].nodeName == 'details'
          ? $curr
          : $curr.parent('details').length > 0
          ? $curr.parent('details')
          : $curr.parents('details').length > 0
          ? $($curr.parents('details')[0])
          : null
      $n =
        $endCurr[0].nodeName == 'details'
          ? $curr
          : $endCurr.parent('details').length > 0
          ? $endCurr.parent('details')
          : $endCurr.parents('details').length > 0
          ? $($endCurr.parents('details')[0])
          : null

      if ($p != null) {
        var _startOffset = this.selection._bakRange.startOffset
        var _endOffset = this.selection._bakRange.endOffset
        var firstSum = $p.find('summary:first')[0]
        var startSum =
          $curr[0].nodeName.toLocaleLowerCase() == 'summary'
            ? $curr[0]
            : $curr.parent('summary').length > 0
            ? $curr.parent('summary')[0]
            : $curr.parents('summary').length > 0
            ? $curr.parents('summary')[0]
            : null
        /*如果开始点是第一个summary&&选取结束也含有details判断是否是同一个如果是且结束选区是内容选取，整个details选中*/
        if (firstSum == startSum && $n != null && $n[0] == $p[0] && $curr[0] != $endCurr[0]) {
          _range.selectNode($p[0])
          _range.select()
        } else if ($n != null && $n[0] != $p[0]) {
          /*如果不是同一个details清除选中*/
          if (_startOffset == 0) {
            _range.setEndAfter($n[0])
            _range.select()
          } else {
            this.selection.clearRange()
          }
        } else if ($n == null) {
          if (_startOffset != 0 || (firstSum != startSum && _startOffset == 0)) {
            this.selection.clearRange()
          }
        }
      } else if ($n != null) {
        _range.setEndAfter($n[0])
        _range.select()
      }

      /*选中区段end*/

      //新版区段
      var item = 'details-info'
      var $p = _hasAttr($curr, 'data-class', item)
        ? $curr
        : _hasAttr($curr.parent(), 'data-class', item)
        ? $curr.parent()
        : $curr.parents("span[data-class='" + item + "'],div[data-class='" + item + "']").length > 0
        ? $($curr.parents("span[data-class='" + item + "'],div[data-class='" + item + "']")[0])
        : null
      var $n = _hasAttr($endCurr, 'data-class', item)
        ? $endCurr
        : _hasAttr($endCurr.parent(), 'data-class', item)
        ? $endCurr.parent()
        : $endCurr.parents("span[data-class='" + item + "'],div[data-class='" + item + "']")
            .length > 0
        ? $($endCurr.parents("span[data-class='" + item + "'],div[data-class='" + item + "']")[0])
        : null
      var _startOffset = this.selection._bakRange.startOffset
      var _endOffset = this.selection._bakRange.endOffset

      if ($p != null) {
        if ($curr.parent()[0] != $endCurr.parent()[0]) {
          item = 'details-summary'
          var sum = _hasAttr($curr, 'data-class', item)
            ? $curr
            : _hasAttr($curr.parent(), 'data-class', item)
            ? $curr.parent()
            : $curr.parents("span[data-class='" + item + "'],div[data-class='" + item + "']")
                .length > 0
            ? $($curr.parents("span[data-class='" + item + "'],div[data-class='" + item + "']")[0])
            : null
          //在开始位置
          if (sum != null && _startOffset == 0) {
            //结尾选中也是details
            if ($n != null) {
              item = 'details-content'
              var content = _hasAttr($endCurr, 'data-class', item)
                ? $endCurr
                : _hasAttr($endCurr.parent(), 'data-class', item)
                ? $endCurr.parent()
                : $endCurr.parents("span[data-class='" + item + "'],div[data-class='" + item + "']")
                    .length > 0
                ? $(
                    $endCurr.parents(
                      "span[data-class='" + item + "'],div[data-class='" + item + "']"
                    )[0]
                  )
                : null
              if (content != null) {
                _range.setStartBefore($n[0])
                _range.setEndAfter($p[0])
                _range.select()
              } else {
                this.selection.clearRange()
              }
            }
          } else {
            item = 'details-content'
            var sum = _hasAttr($curr, 'data-class', item)
              ? $curr
              : _hasAttr($curr.parent(), 'data-class', item)
              ? $curr.parent()
              : $curr.parents("span[data-class='" + item + "'],div[data-class='" + item + "']")
                  .length > 0
              ? $(
                  $curr.parents("span[data-class='" + item + "'],div[data-class='" + item + "']")[0]
                )
              : null
            if (sum == null) {
              this.selection.clearRange()
            }
          }
        }
      }
      //End新版区段
    })
    ue.addListener('keydown', function(type, event) {
      //var _startOffset = this.selection._bakRange.startOffset;
      //var $curr = $(this.selection._bakRange.startContainer);
      //var $endCurr = $(this.selection._bakRange.endContainer);
      var _range = this.selection.getRange()
      var $curr = $(_range.startContainer)
      var $endCurr = $(_range.endContainer)
      var _startOffset = _range.startOffset
      var _endOffset = _range.endOffset

      var _delBlockArr = [
        'tab-lis-item',
        'tab-prev',
        'tab-next',
        'tab-add',
        'tabs-close',
        'tab-close',
        'details-summary',
        'details-content'
      ]
      var _isGoTo = true
      for (var i = 0; i < _delBlockArr.length; i++) {
        var item = _delBlockArr[i]
        var $p = _hasAttr($curr, 'data-class', item)
          ? $curr
          : _hasAttr($curr.parent(), 'data-class', item)
          ? $curr.parent()
          : $curr.parents("span[data-class='" + item + "'],div[data-class='" + item + "']").length >
            0
          ? $($curr.parents("span[data-class='" + item + "'],div[data-class='" + item + "']")[0])
          : null
        if (
          !(event.ctrlKey && event.code == 'KeyV') &&
          !(event.ctrlKey && event.code == 'KeyC') &&
          !(event.ctrlKey && event.code == 'KeyX')
        ) {
          if ($p != null) {
            $n = _hasAttr($endCurr, 'data-class', item)
              ? $endCurr
              : _hasAttr($endCurr.parent(), 'data-class', item)
              ? $endCurr.parent()
              : $endCurr.parents("span[data-class='" + item + "'],div[data-class='" + item + "']")
                  .length > 0
              ? $(
                  $endCurr.parents(
                    "span[data-class='" + item + "'],div[data-class='" + item + "']"
                  )[0]
                )
              : null
            if (($n != null && $n[0] != $p[0]) || $n == null) {
              if (event.preventDefault) {
                event.preventDefault()
              } else {
                window.event.returnValue = false //IE
              }

              _isGoTo = false
              return false
            }
          } else {
            win.$n = _hasAttr($endCurr, 'data-class', item)
              ? $endCurr
              : _hasAttr($endCurr.parent(), 'data-class', item)
              ? $endCurr.parent()
              : $endCurr.parents("span[data-class='" + item + "'],div[data-class='" + item + "']")
                  .length > 0
              ? $(
                  $endCurr.parents(
                    "span[data-class='" + item + "'],div[data-class='" + item + "']"
                  )[0]
                )
              : null
            if ($n != null) {
              if (event.preventDefault) {
                event.preventDefault()
              } else {
                window.event.returnValue = false //IE
              }
              _isGoTo = false
              return false
            }
          }
        }
      }

      if (event.ctrlKey && event.code == 'KeyC') {
        /*全部打开，防止复制不了收起的内容*/
        $(this.body)
          .find('details')
          .attr('open', '')
      }
      if (event.code == 'Delete') {
        _delBlockArr = [
          'tab-lis-item',
          'tab-prev',
          'tab-next',
          'tab-add',
          'tabs-close',
          'tab-close',
          'details-summary'
        ]
        var _startOffset = this.selection._bakRange.startOffset
        var _endOffset = this.selection._bakRange.endOffset
        var _len = this.selection._bakRange.startContainer.length
        var $curr = $(this.selection._bakRange.startContainer)
        if (_len == _endOffset) {
          if (this.selection._bakRange.startContainer.nodeName == '#text') {
            var _falg =
              $curr.parent().next("div[data-class='tab-list']").length > 0
                ? true
                : $curr.parents().next("div[data-class='tab-list']").length > 0
                ? true
                : false
            var _falg2 =
              $curr.parent().next('details').length > 0
                ? true
                : $curr.parents().next('details').length > 0
                ? true
                : false
            var _falg3 =
              $curr.parent().next("div[data-class='details-info']").length > 0
                ? true
                : $curr.parents().next("div[data-class='details-info']").length > 0
                ? true
                : false

            if (_falg || _falg2 || _falg3) {
              if (event.preventDefault) {
                event.preventDefault()
              } else {
                window.event.returnValue = false //IE
              }
              return false
            }
          }
        }
        if (_hasAttr($curr, 'data-class', 'tab-lis-wrap')) {
          if (event.preventDefault) {
            event.preventDefault()
          } else {
            window.event.returnValue = false //IE
          }
          return false
        }

        for (var i = 0; i < _delBlockArr.length; i++) {
          var item = _delBlockArr[i]
          var $p = _hasAttr($curr, 'data-class', item)
            ? $curr
            : _hasAttr($curr.parent(), 'data-class', item)
            ? $curr.parent()
            : $curr.parents("span[data-class='" + item + "'],div[data-class='" + item + "']")
                .length > 0
            ? $($curr.parents("span[data-class='" + item + "'],div[data-class='" + item + "']")[0])
            : null
          if ($p != null) {
            if (event.preventDefault) {
              event.preventDefault()
            } else {
              window.event.returnValue = false //IE
            }
            _isGoTo = false
            return false
          }
        }
        /*是否是在tab-item删除*/
        var $tabItem = _hasAttr($endCurr, 'data-class', 'tab-item')
          ? $endCurr
          : _hasAttr($endCurr.parent(), 'data-class', 'tab-item')
          ? $endCurr.parent("div[data-class='tab-item']")
          : $endCurr.parents("div[data-class='tab-item']").length > 0
          ? $($endCurr.parents("div[data-class='tab-item']")[0])
          : null
        if ($tabItem != null) {
          if (
            typeof _range.endContainer.length == 'undefined' ||
            _endOffset >= _range.endContainer.length
          ) {
            if (event.preventDefault) {
              event.preventDefault()
            } else {
              window.event.returnValue = false //IE
            }
            return false
          }
        }
        /*分段*/
        $n =
          $endCurr[0].nodeName == 'details'
            ? $curr
            : $endCurr.parent('details').length > 0
            ? $endCurr.parent('details')
            : $endCurr.parents('details').length > 0
            ? $($endCurr.parents('details')[0])
            : null
        if ($n != null) {
          /*如果是标题的*/
          var firstSum = $n.find('summary:first')[0]
          var startSum =
            $endCurr[0].nodeName.toLocaleLowerCase() == 'summary'
              ? $endCurr[0]
              : $endCurr.parent('summary').length > 0
              ? $endCurr.parent('summary')[0]
              : $endCurr.parents('summary').length > 0
              ? $endCurr.parents('summary')[0]
              : null
          if (firstSum == startSum) {
            if (
              typeof _range.endContainer.length == 'undefined' ||
              _endOffset >= _range.endContainer.length
            ) {
              if (event.preventDefault) {
                event.preventDefault()
              } else {
                window.event.returnValue = false //IE
              }
              return false
            }
          } else {
            if (
              typeof _range.endContainer.length == 'undefined' ||
              _endOffset >= _range.endContainer.length
            ) {
              if (event.preventDefault) {
                event.preventDefault()
              } else {
                window.event.returnValue = false //IE
              }
              return false
            }
          }
        }
        /*新分段限制*/
      }
      /*按下删除键*/
      if (event.code == 'Backspace') {
        _delBlockArr = [
          'tab-lis-item',
          'tab-prev',
          'tab-next',
          'tab-add',
          'tabs-close',
          'tab-close'
        ]
        /*tab*/
        if (_hasAttr($curr, 'data-class', 'tab-lis-wrap')) {
          if (event.preventDefault) {
            event.preventDefault()
          } else {
            window.event.returnValue = false //IE
          }
          return false
        }
        for (var i = 0; i < _delBlockArr.length; i++) {
          var item = _delBlockArr[i]
          var $p = _hasAttr($curr, 'data-class', item)
            ? $curr
            : _hasAttr($curr.parent(), 'data-class', item)
            ? $curr.parent()
            : $curr.parents("span[data-class='" + item + "'],div[data-class='" + item + "']")
                .length > 0
            ? $($curr.parents("span[data-class='" + item + "'],div[data-class='" + item + "']")[0])
            : null

          if (($p != null && $p.text() == '') || ($p != null && _startOffset == 0)) {
            if (event.preventDefault) {
              event.preventDefault()
            } else {
              window.event.returnValue = false //IE
            }
            _isGoTo = false
            return false
          }
          if ($p != null) {
            if ($curr.parent()[0] != $endCurr.parent()[0]) {
              if (event.preventDefault) {
                event.preventDefault()
              } else {
                window.event.returnValue = false //IE
              }
              _isGoTo = false
              return false
            }
          }
        }

        /*阻断删除页签*/
        var $pannelItem = _hasAttr($curr, 'data-class', 'tab-item')
          ? $curr
          : _hasAttr($curr.parent(), 'data-class', 'tab-item')
          ? $curr.parent()
          : $curr.parents("div[data-class='tab-item']").length > 0
          ? $curr.parents("div[data-class='tab-item']")
          : null
        if (
          ($pannelItem != null && $.trim($pannelItem.text()) == '') ||
          ($pannelItem != null && _startOffset == 0)
        ) {
          if (!_hasAttr($curr, 'data-class', 'tab-item')) {
            var $prve = $curr.prev()
            if ($prve.length == 0) {
              if (event.preventDefault) {
                event.preventDefault()
              } else {
                window.event.returnValue = false //IE
              }
              return false
            } else if (_hasAttr($prve, 'data-class', 'tab-list')) {
              $prve.remove()
            }
          } else {
            if (event.preventDefault) {
              event.preventDefault()
            } else {
              window.event.returnValue = false //Ie
            }
            return false
          }
        } else if (_hasAttr($curr.prev(), 'data-class', 'tab-list')) {
          $curr.prev().remove()
        }
        /*分段*/
        $p =
          $curr[0].nodeName == 'details'
            ? $curr
            : $curr.parent('details').length > 0
            ? $curr.parent('details')
            : $curr.parents('details').length > 0
            ? $($curr.parents('details')[0])
            : null
        //$n = $endCurr[0].nodeName == "details" ? $curr : $endCurr.parent("details").length > 0 ? $endCurr.parent("details") : $endCurr.parents("details").length > 0 ? $($endCurr.parents("details")[0]) : null;

        if ($p != null) {
          var firstSum = $p.find('summary:first')[0]
          var startSum =
            $curr[0].nodeName.toLocaleLowerCase() == 'summary'
              ? $curr[0]
              : $curr.parent('summary').length > 0
              ? $curr.parent('summary')[0]
              : $curr.parents('summary').length > 0
              ? $curr.parents('summary')[0]
              : null
          if (firstSum != startSum) {
            var pp = $curr.parent()[0]
            var ppp = $curr.parents()[0]
            var sn = $(firstSum).next()[0]
            if (_startOffset == 0 && (sn == $curr[0] || sn == pp || sn == ppp)) {
              if (event.preventDefault) {
                event.preventDefault()
              } else {
                window.event.returnValue = false //Ie
              }
              return false
            }
          }
        }

        var parent = this.selection._bakRange.startContainer.parentNode
        if (
          parent != null &&
          parent.nodeName != null &&
          parent.nodeName != null &&
          parent.nodeName.toLowerCase() == 'details'
        ) {
          if (
            $(parent).text() == '' ||
            $(parent).text().length == 1 ||
            $(parent)
              .find('summary')
              .text() == ''
          ) {
            $(parent).remove()
          }
        }
        /*新版分段*/
        var $pannelItem = _hasAttr($curr, 'data-class', 'details-content')
          ? $curr
          : _hasAttr($curr.parent(), 'data-class', 'details-content')
          ? $curr.parent()
          : $curr.parents("div[data-class='details-content']").length > 0
          ? $curr.parents("div[data-class='details-content']")
          : null
        if (
          ($pannelItem != null && $.trim($pannelItem.text()) == '') ||
          ($pannelItem != null && _startOffset == 0)
        ) {
          if (!_hasAttr($curr, 'data-class', 'details-content')) {
            var $prve = $curr.prev()
            if ($prve.length == 0) {
              var $p =
                $curr.parent("div[data-class='details-info']").length > 0
                  ? $curr.parent("div[data-class='details-info']")
                  : $curr.parents("div[data-class='details-info']").length > 0
                  ? $($curr.parents("div[data-class='details-info']")[0])
                  : null

              if ($p != null) {
                if ($p.find('div[data-class="details-summary"] p').length > 0) {
                  var p = $p.find('div[data-class="details-summary"] p')[0]
                  _range.setStartAtLast(p)
                  _range.setCursor()
                }
              }

              if (event.preventDefault) {
                event.preventDefault()
              } else {
                window.event.returnValue = false //IE
              }
              return false
            } else if (_hasAttr($prve, 'data-class', 'details-info')) {
              $prve.remove()
            }
          } else {
            if (event.preventDefault) {
              event.preventDefault()
            } else {
              window.event.returnValue = false //Ie
            }
            return false
          }
        } else if (_hasAttr($curr.prev(), 'data-class', 'details-info')) {
          $curr.prev().remove()
        }
        var $parent =
          $curr.parent("div[data-class='details-summary']").length > 0
            ? $curr.parent("div[data-class='details-summary']")
            : $curr.parents("div[data-class='details-summary']").length > 0
            ? $($curr.parents("div[data-class='details-summary']")[0])
            : null
        if ($parent != null) {
          if ($(parent).text() == '') {
            $(parent)
              .parent()
              .remove()
          }
        }
      }
      /*按下Enter键*/
      if (13 === event.keyCode) {
        var _flag =
          _hasAttr($curr, 'data-class', 'tab-lis-item') ||
          _hasAttr($curr.parent(), 'data-class', 'tab-lis-item') ||
          $curr.parents("div[data-class='tab-lis-item']").length > 0
        var _flag2 =
          _hasAttr($curr, 'data-class', 'details-summary') ||
          _hasAttr($curr.parent(), 'data-class', 'details-summary') ||
          $curr.parents("div[data-class='details-summary']").length > 0
        if (_flag || _flag2) {
          if (event.preventDefault) {
            event.preventDefault()
          } else {
            window.event.returnValue = false //IE
          }
          return false
        }

        $p =
          $curr[0].nodeName == 'details'
            ? $curr
            : $curr.parent('details').length > 0
            ? $curr.parent('details')
            : $curr.parents('details').length > 0
            ? $($curr.parents('details')[0])
            : null
        if ($p != null) {
          var firstSum = $p.find('summary:first')[0]
          var startSum =
            $curr[0].nodeName.toLocaleLowerCase() == 'summary'
              ? $curr[0]
              : $curr.parent('summary').length > 0
              ? $curr.parent('summary')[0]
              : $curr.parents('summary').length > 0
              ? $curr.parents('summary')[0]
              : null
          if (firstSum == startSum) {
            var _html = $p.html()
            $p.attr('data-html', _html)
            if (event.preventDefault) {
              event.preventDefault()
            } else {
              window.event.returnValue = false //IE
            }
            return false
          }
        }

        //var $curr = $(this.selection._bakRange.startContainer);
        //var parent = this.selection._bakRange.startContainer.parentNode;
        //if (parent != null && parent.nodeName != null && parent.nodeName.toLowerCase() == "summary") {
        //    if (parent.parentNode.nodeName.toLowerCase() == "details") {
        //        var _html = $(parent).parent().html();
        //        $(parent).parent().attr("data-html", _html);

        //    }
        //}
      }
    })
    ue.addListener('keyup', function(type, event) {
      var _startOffset = this.selection._bakRange.startOffset
      var $curr = $(this.selection._bakRange.startContainer)
      var $endCurr = $(this.selection._bakRange.endContainer)

      var $p = _hasAttr($curr, 'data-class', 'tab-lis')
        ? $curr
        : _hasAttr($curr.parent(), 'data-class', 'tab-lis')
        ? $curr.parent()
        : $curr.parents("span[data-class='tab-lis'],div[data-class='tab-lis']").length > 0
        ? $($curr.parents("span[data-class='tab-lis'],div[data-class='tab-lis']")[0])
        : null
      if ($p != null) {
        _ueTabIsOver($p)
      }
      /*Backspace键弹起时*/
      if (event.code == 'Backspace') {
        var parent = this.selection._bakRange.startContainer.parentNode
        if (
          parent != null &&
          parent.nodeName != null &&
          parent.nodeName.toLowerCase() == 'details'
        ) {
          if (
            $(parent).text() == '' ||
            $(parent).text().length == 1 ||
            $(parent).find('summary').length == 0
          ) {
            $(parent).remove()
          }
          //if ($(parent).attr("data-delete") == "true")
          //{
          //    $(parent).remove();
          //}
        }
      }
      /*Enter键弹起时*/
      if (13 === event.keyCode) {
        $p =
          $curr[0].nodeName == 'details'
            ? $curr
            : $curr.parent('details').length > 0
            ? $curr.parent('details')
            : $curr.parents('details').length > 0
            ? $($curr.parents('details')[0])
            : null
        if ($p != null) {
          //var firstSum = $p.find("summary:first")[0];
          //var startSum = $curr[0].nodeName.toLocaleLowerCase() == "summary" ? $curr[0] : $curr.parent("summary").length > 0 ? $curr.parent("summary")[0] : $curr.parents("summary").length > 0 ? $curr.parents("summary")[0] : null;
          //if (firstSum == startSum) {
          var _html = $p.attr('data-html')
          if (_html != null && typeof _html != 'undefined' && _html != '') {
            $p.attr('data-html', '')
            $p.html(_html)
            _ueTab(this)
            $(this.body)
              .find('details')
              .each(function(i, item) {
                if ($(item).find('summary').length == 0) {
                  $(item).remove()
                }
              })
          }
          if (event.preventDefault) {
            event.preventDefault()
          } else {
            window.event.returnValue = false //IE
          }
          return false
          // }
        }
        //debugger
        //var parent = this.selection._bakRange.startContainer.parentNode;
        //if (parent.nodeName != null && parent.nodeName.toLowerCase() == "summary") {
        //    if (parent != null && parent.nodeName != null && parent.parentNode.nodeName.toLowerCase() == "details") {
        //        var $parent = $(parent).parent();
        //        var _html = $parent.attr("data-html");
        //        if (_html != null && typeof _html != "undefined") {
        //            $parent.attr("data-html", "");
        //            $parent.html(_html);
        //            $("<p></br></p>").insertAfter($parent);
        //        }
        //    }
        //}
      }
    })
    ue.addListener('beforepaste', function(a, b, c, d) {
      var _range = this.selection.getRange()
      $curr = $(_range.startContainer)
      $endCurr = $(_range.endContainer)
      /*tab复制*/
      if (b.html.indexOf('data-class') > 0) {
        var $table = $curr.parents('table')
        if ($table.length > 0) {
          var _lang = this.getLang()
          b.html = ''
          alert(_lang.uecustomer.notable_insert)
          return false
        }
        var $bc = $("<div id='beforepaste_div_container' style='display:none;'></div>")
        var $html = $(b.html)
        $('body').append($bc)
        $bc.append($html)
        var $list = $bc.find("div[data-class='tab-list']")
        $list.attr('style', '')
        $list.find("div[data-class='tab-lis']").attr('style', '')
        $list.find('span[data-class="tab-close"]').attr('style', '')
        $list.find('span[data-class="tab-add"]').attr('style', '')
        $list.find('span[data-class="tabs-close"]').attr('style', '')
        $list.find('span[data-class="tab-prev"]').attr('style', '')
        $list.find('span[data-class="tab-next"]').attr('style', '')

        $list.find('div[data-class="tab-close"]').attr('style', '')
        $list.find('div[data-class="tab-add"]').attr('style', '')
        $list.find('div[data-class="tabs-close"]').attr('style', '')
        $list.find('div[data-class="tab-prev"]').attr('style', '')
        $list.find('div[data-class="tab-next"]').attr('style', '')

        $bc.find("div[data-class='details-summary']").attr('style', '')

        b.html = $bc.html()
        $bc.remove()
      }
      /*区段*/

      if (b.html.indexOf('details') > 0) {
        var $table = $curr.parents('table')
        if ($table.length > 0) {
          var _lang = this.getLang()
          b.html = ''
          alert(_lang.uecustomer.notable_insert)
          return false
        }
        var $bc = $("<div id='beforepaste_div_container' style='display:none;'></div>")
        var $html = $(b.html)
        $('body').append($bc)
        $bc.append($html)
        $bc
          .find('details')
          .find('#details-marker')
          .remove()
        b.html = $bc.html()
        $bc.remove()
      }
    })

    ue.addListener('afterpaste', function(a, b, c, d) {
      _ueTab(ue)
    })
  }

  function _ueTabIsOver($elementLis) {
    var $inner = $($elementLis.find("div[data-class='tab-list-inner']")[0])
    var $wrap = $($elementLis.find("div[data-class='tab-lis-wrap']")[0])
    var $inner = $($elementLis.find("div[data-class='tab-list-inner']")[0])
    if ($wrap.width() > $inner.width()) {
      $elementLis.attr('data-isover', 'true')
      return true
    } else {
      var $wrap = $($elementLis.find("div[data-class='tab-lis-wrap']")[0])
      $wrap.stop().animate({left: '0px'}, 100)
      $elementLis.attr('data-isover', 'false')
    }
    return false
  }
  function _ueTab(ue) {
    _ueDetails(ue)
    $(ue.body)
      .find("div[data-class='tab-list']")
      .each(function(i, v) {
        /*绑定选择页签事件*/
        $(v)
          .find("div[data-class='tab-lis-item']")
          .unbind('click')
          .bind('click', function() {
            var $parents = $($(this).parents("div[data-class='tab-list']")[0])
            var _index = $(this).attr('data-index')
            $(this)
              .addClass('active')
              .attr('data-active', 'active')
              .siblings()
              .removeClass('active')
              .attr('data-active', '')
            $($parents.find("div[data-class='tab-items']")[0])
              .children("div[data-class='tab-item'][data-index='" + _index + "']")
              .attr('data-active', 'active')
              .siblings("div[data-class='tab-item']")
              .attr('data-active', '') //.css({ "position:": "absolute", "left": "-999999px" });
            ue.fireEvent('contentChange')
          })
        /*绑定删除单个也签事件*/
        $(v)
          .find("span[data-class='tab-close'],div[data-class='tab-close']")
          .unbind('click')
          .bind('click', function() {
            var $parents = $($(this).parents("div[data-class='tab-list']")[0])
            var $item = $(this).parent("div[data-class='tab-lis-item']")
            var $next =
              $item.next().length > 0 ? $item.next() : $item.prev().length > 0 ? $item.prev() : null
            var _index = $item.attr('data-index')
            $($parents.find("div[data-class='tab-items']")[0])
              .children("div[data-class='tab-item'][data-index='" + _index + "']")
              .remove()
            $item.remove()
            _ueTabIsOver($($parents.find("div[data-class='tab-lis']")[0]))
            if ($next != null) {
              _index = $next.attr('data-index')
              $next
                .addClass('active')
                .attr('data-active', 'active')
                .siblings()
                .removeClass('active')
                .attr('data-active', '')

              $($parents.find("div[data-class='tab-items']")[0])
                .children("div[data-class='tab-item'][data-index='" + _index + "']")
                .attr('data-active', 'active')
                .siblings("div[data-class='tab-item']")
                .attr('data-active', '')
            } else {
              $parents.remove()
            }
            ue.fireEvent('contentChange')
            return false
          })

        /*添加页签*/
        $(v)
          .find("span[data-class='tab-add'],div[data-class='tab-add']")
          .unbind('click')
          .bind('click', function() {
            var $parents = $($(this).parents("div[data-class='tab-list']")[0])
            // var _index = String((new Date()).getTime()).substr(8, 13)
            var _index = $parents.find('.tab-lis-item').length + 2;
            var _tab =
              '<div class="tab-lis-item" data-class="tab-lis-item" data-filter="skipempty"  data-index="' +
              _index +
              '">'
            _tab += '<p>'
            _tab += '页签' + _index
            _tab +=
              '</p><div class="tab-close" data-class="tab-close" data-filter="skipempty" ></div><div class="drag-handler" data-filter="skipempty"></div>'
            _tab += '</div>'
            var _pannel =
              '<div class="tab-item" data-class="tab-item" data-filter="skipempty"   data-index="' +
              _index +
              '" data-active="">'
            _pannel += '<p><br/>'
            _pannel += '</p>'
            _pannel += '</div>'
            var $tab = $(_tab)
            var $pannel = $(_pannel)
            $($parents.find("div[data-class='tab-lis-wrap']")[0]).append($tab)
            $($parents.find("div[data-class='tab-items']")[0]).append($pannel)

            var _isOver = _ueTabIsOver($($parents.find("div[data-class='tab-lis']")[0]))
            /*绑定选择页签事件*/
            $tab.unbind('click').bind('click', function() {
              var _index = $tab.attr('data-index')
              $tab
                .addClass('active')
                .attr('data-active', 'active')
                .siblings()
                .removeClass('active')
                .attr('data-active', '')
              $($parents.find("div[data-class='tab-items']")[0])
                .children("div[data-class='tab-item'][data-index='" + _index + "']")
                .attr('data-active', 'active')
                .siblings("div[data-class='tab-item']")
                .attr('data-active', '')
              ue.fireEvent('contentChange')
            })
            /*绑定删除单个也签事件*/
            $tab
              .find("span[data-class='tab-close'],div[data-class='tab-close']")
              .unbind('click')
              .bind('click', function() {
                var $parents = $($(this).parents("div[data-class='tab-list']")[0])
                var $item = $(this).parent("div[data-class='tab-lis-item']")
                var $next =
                  $item.next().length > 0
                    ? $item.next()
                    : $item.prev().length > 0
                    ? $item.prev()
                    : null
                var _index = $item.attr('data-index')
                $($parents.find("div[data-class='tab-items']")[0])
                  .children("div[data-class='tab-item'][data-index='" + _index + "']")
                  .remove()
                $item.remove()
                _ueTabIsOver($($parents.find("div[data-class='tab-lis']")[0]))
                if ($next != null) {
                  _index = $next.attr('data-index')
                  $next
                    .addClass('active')
                    .attr('data-active', 'active')
                    .siblings()
                    .removeClass('active')
                    .attr('data-active', '')
                  $($parents.find("div[data-class='tab-items']")[0])
                    .children("div[data-class='tab-item'][data-index='" + _index + "']")
                    .attr('data-active', 'active')
                    .siblings("div[data-class='tab-item']")
                    .attr('data-active', '')
                } else {
                  $parents.remove()
                }
                ue.fireEvent('contentChange')
                return false
              })
            if (_isOver) {
              var $li = $($parents.find("div[data-class='tab-lis']")[0])
              var $wrap = $($li.find("div[data-class='tab-lis-wrap']")[0])
              var $inner = $($li.find("div[data-class='tab-list-inner']")[0])
              var _jw = $inner.width() - $wrap.width() - 10
              $wrap.stop().animate({left: _jw + 'px'}, 100)
            }
            $tab.click()
            ue.fireEvent('contentChange')
          })

        /*删除所有页签*/
        $(v)
          .find("span[data-class='tabs-close'],div[data-class='tabs-close']")
          .unbind('click')
          .bind('click', function() {
            $($(this).parents("div[data-class='tab-list']")[0]).remove()
            ue.fireEvent('contentChange')
          })

        /*上一页*/
        $(v)
          .find("span[data-class='tab-prev'],div[data-class='tab-prev']")
          .unbind('click')
          .bind('click', function() {
            var _stepWidth = 100
            var $lis = $($(this).parents("div[data-class='tab-lis']")[0])
            var $inner = $($lis.find("div[data-class='tab-list-inner']")[0])
            var $wrap = $($lis.find("div[data-class='tab-lis-wrap']")[0])
            var _left = $wrap.position().left
            if (_left < 0) {
              var _jw = _left + _stepWidth
              if (_jw > 0) {
                _jw = 0
              }
              $wrap.stop().animate({left: _jw + 'px'}, 100)
              //$wrap.css({ "left": _jw + "px" })
            }
          })
        /*下一页*/
        $(v)
          .find("span[data-class='tab-next'],div[data-class='tab-next']")
          .unbind('click')
          .bind('click', function() {
            var _stepWidth = 100
            var $lis = $($(this).parents("div[data-class='tab-lis']")[0])
            var $inner = $($lis.find("div[data-class='tab-list-inner']")[0])
            var $wrap = $($lis.find("div[data-class='tab-lis-wrap']")[0])
            var _left = $wrap.position().left
            if (_left <= 0 && $wrap.width() - -_left > $inner.width()) {
              var _jw = 0
              if ($wrap.width() - $inner.width() - -_left > _stepWidth) {
                _jw = _left - _stepWidth
              } else {
                _jw = _left - 20
              }
              $wrap.stop().animate({left: _jw + 'px'}, 100)
              //$wrap.css({ "left": _jw + "px" })
            }
          })

        var lis = $(v).find("div[data-class='tab-lis-wrap']")[0];

        if (lis) {
          var status = $(lis).closest('bod页签1y').attr('contenteditable');

          new Sortable($(v).find("div[data-class='tab-lis-wrap']")[0],{
            animation: 150,
            ghostClass: 'blue-background-class'
          })

          $(lis).on('mouseenter', '.drag-handler', function(e) {
            status = $(lis).closest('body').attr('contenteditable');
            if (!status) return;
            $(lis).closest('body').attr('contenteditable', false)

            $(lis).on('mouseleave', '.drag-handler', '.tab-lis-item', function(e) {
              $(lis).closest('body').attr('contenteditable', true)
              $(lis).unbind('mouseleave')
              ue.fireEvent('contentChange');
            })
          })

        }

      })


  }
  function _ueDetails(ue) {
    $(ue.body)
      .find("div[data-class='details-info']")
      .each(function(i, v) {
        $(v)
          .find("div[data-class='details-summary']")
          .unbind('click')
          .bind('click', function() {
            if (
              $(this)
                .parent()
                .attr('data-open') == 'true'
            ) {
              $(this)
                .parent()
                .attr('data-open', '')
            } else {
              $(this)
                .parent()
                .attr('data-open', 'true')
            }
          })
      })
  }

  function _removeUEPastBinNode(ue) {
    if (ue && ue.document) {
      var nodes = []
      if (typeof document.querySelectorAll == 'function') {
        nodes = ue.document.querySelectorAll('#baidu_pastebin')
      } else {
        nodes = ue.document.getElementById('baidu_pastebin')
      }
      if (nodes && nodes.length > 0) {
        for (var i = 0; i < nodes.length; i++) {
          var node = nodes[i]
          node.parentNode.removeChild(node)
        }
      }
    }
  }
  return {
    initCommands: _initCommands,
    hasAttr: _hasAttr,
    ueditorDrawBack: _ueditorDrawBack,
    ueTabIsOver: _ueTabIsOver,
    ueTab: _ueTab,
    removeUEPastBinNode: _removeUEPastBinNode
  }
}

window.UeCustomerHandler = UeCustomerHandler(window, jQuery)
window.UeCustomerHandler.initCommands()
