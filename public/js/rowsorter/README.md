RowSorter.js
============
## Drag & drop row sorter plugin.
* Works on Touch devices.
* Supports IE8+ and all other modern browsers.
* No framework dependency (But registers itself as a jquery plugin if exists.)

### Install
    bower install rowsorter
```html
<script type="text/javascript" src="/path/dist/RowSorter.js"></script>
```

### Usage
```javascript
<script type="text/javascript">
//// No Framework
// Set table as sortable
new RowSorter('#table_id'/*, options*/);
// Revert last drag
RowSorter.revert('#table_id');
// Destroy sortable
RowSorter.destroy('#table_id');

//// jQuery Plugin
// Set table as sortable
$('#table_id').rowSorter(/*options*/);
// Revert last drag
$.rowSorter.revert('#table_id');
// Destroy sortable
$.rowSorter.destroy('#table_id');
</script>
```

### Options:

    @string   handler         : drag handler selector (default: null)
    @boolean  tbody           : pass true if want to sort only tbody > tr. (default: true)
    @string   tableClass      : adds this class name to table while rows are sorting (default: "sorting-table")
    @string   dragClass       : dragging row's class name (default: "sorting-row").
    @number   stickTopRows    : count of top sticky rows (default: 0),
    @number   stickBottomRows : count of bottom sticky rows (default: 0),
    @function onDragStart     : (default: null)
    @function onDragEnd       : (default: null)
    @function onDrop          : (default: null)

#### Handling Events
```javascript
    onDragStart: function(tbody, row, old_index) {
        // find the table
        // if options.tbody is true, this param will be tbody element
        // otherwise it will be table element
        var table = tbody.tagName === "TBODY" ? tbody.parentNode : tbody;

        // old_index is zero-based index of row in tbody (or table if tbody not exists)
        console.log(table, row, old_index);
    },

    // if new_index === old_index, this function won't be called.
    onDrop: function(tbody, row, new_index, old_index) {
        // find the table
        // if options.tbody is true, this param will be tbody element
        // otherwise it will be table element
        var table = tbody.tagName === "TBODY" ? tbody.parentNode : tbody;

        // old_index is stored index of row in table/tbody before start the dragging.
        // new_index is index of row in table/tbody after the row has been dragged.
        console.log(table, row, new_index, old_index);
    },

    // if new_index === old_index, this function will be called.
    onDragEnd: function(tbody, row, current_index) {
        console.log('Dragging the ' + current_index + '. row canceled.');
    }
```

### Samples

* [Basic Usage][basic]
* [Custom Handler 1][handler1]
* [Custom Handler 2][handler2]
* [Sticky Top & Bottom][sticky]
* [jQuery Plugin][jquery]
* [Custom CSS][style]
* [Big Table][bigtable]
* [Mobile Sample][touchtest]
* [Revert][revert]

### File Sizes

* Minified: ~7kb
* Minified and gzipped: < 3kb

[basic]: http://borayazilim.com/projects/rowsorter/examples/basic.html
[handler1]: http://borayazilim.com/projects/rowsorter/examples/handler1.html
[handler2]: http://borayazilim.com/projects/rowsorter/examples/handler2.html
[sticky]: http://borayazilim.com/projects/rowsorter/examples/sticky.html
[jquery]: http://borayazilim.com/projects/rowsorter/examples/jquery.html
[style]: http://borayazilim.com/projects/rowsorter/examples/style.html
[bigtable]: http://borayazilim.com/projects/rowsorter/examples/big_table.php
[touchtest]: http://borayazilim.com/projects/rowsorter/examples/touch_test.html
[revert]: http://borayazilim.com/projects/rowsorter/examples/revert.html
