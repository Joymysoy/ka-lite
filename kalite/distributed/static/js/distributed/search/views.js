window.AutoCompleteView = BaseView.extend({

    template: HB.template("search/search-bar"),

    item_template: HB.template("search/search-item"),

    tagName: "li", 

    events: {
        "input #search": "input_changed",
        "focus #search": "fetch_topic_tree",
        "click #search-button": "submit_form"
    },

    initialize: function() {

        _.bindAll(this);

        this._titles = {};
        this._keywords = {};

        this.render();

    },

    search_items: ["tags", "keywords"],

    fetch_topic_tree: function () {
        var self = this;
        if (this._nodes===undefined) {
            doRequest(window.sessionModel.get("SEARCH_TOPICS_URL"), null, {
                cache: true,
                dataType: "json",
                ifModified: true
            }).success(function(categories, textStatus, xhr) {
                if (xhr.status == 304  && force_reparse !== true) {
                    console.log(sprintf("got the remote topic tree for %s and it is the same as before; not re-parsing.", window.sessionModel.get("CURRENT_LANGUAGE")));
                } else {
                    console.log(sprintf("got the remote topic tree for %s and it wasn't cached; re-parsing.", window.sessionModel.get("CURRENT_LANGUAGE")));

                    self.flatten_nodes(categories);
                }
            });
        }
    },

    flatten_nodes: function (_nodes) {
        var self = this;
        var _titles = this._titles;
        var _keywords = this._keywords;

        // now take that structured object, and reduce.
        var flattened_nodes = {};
        _.each(_nodes, function(val, key) {
            $.extend(flattened_nodes, val);
        });
        _nodes = flattened_nodes;
        _.each(_nodes, function(val, key){
            if(!_.has(_titles, val["title"])){
                _titles[val["title"]] = key;
                var keywords = _.flatten(_.values(_.pick(val, self.search_items)));
                _.each(keywords, function(element, index, list) {
                    if (_keywords[element]===undefined){
                        _keywords[element] = [];
                    }
                    if(!_.contains(key, _keywords[element])) {
                        _keywords[element].push(key);
                    }
                });
            }
        });
        this._nodes = _nodes;
        this._keywords = _keywords;
        this._titles = _titles;
    },

    render: function() {

        this.$el.html(this.template({search_url: window.sessionModel.get("SEARCH_URL")}));

        this.$("#search").autocomplete({
            autoFocus: true,
            minLength: 3,
            appendTo: ".navbar-collapse",
            html: true,  // extension allows html-based labels
            source: this.data_source,
            select: this.select_item
        });

        this.input_changed();

    },

    data_source: function(request, response) {
        var self = this;
        clear_messages();

        // Executed when we're requested to give a list of results
        var titles_filtered = $.ui.autocomplete.filter(_.keys(this._titles), request.term);

        titles_filtered = _.values(_.pick(this._titles, titles_filtered));

        var keywords_filtered = $.ui.autocomplete.filter(_.keys(this._keywords), request.term);

        keywords_filtered = _.flatten(_.values(_.pick(this._keywords, keywords_filtered)));

        var ids_filtered = _.union(titles_filtered, keywords_filtered);

        // sort the titles again, since ordering was lost when we did autocomplete.filter
        var node_type_ordering = ["topic", "video", "exercise", "content"]; // custom ordering, with the last in the array appearing first
        ids_filtered.sort(function(id1, id2) {
            var node1 = self._nodes[id1];
            var node2 = self._nodes[id2];
            // we use the ordering of types found in node_types
            var compvalue = node_type_ordering.indexOf(node2.kind.toLowerCase()) - node_type_ordering.indexOf(node1.kind.toLowerCase());
            return compvalue;
        });

        // From the filtered titles, produce labels (html) and values (for doing stuff)
        var results = [];

        var is_admin = window.statusModel.get("is_admin");
        for (var i = 0; i < ids_filtered.length; i++) {
            var node = this._nodes[ids_filtered[i]];

            // exclude videos that aren't available
            if (!is_admin && node.kind.toLowerCase() == "video" && !node.available) {
                continue;
            }

            var label = this.item_template(node);
            results.push({
                label: label,
                value: ids_filtered[i]
            });
        }

        response(results.slice(0, 15)); // slice after filtering, see #1563
    },

    select_item: function( event, ui ) {
        // When they click a specific item, just go there (if we recognize it)
        var id = ui.item.value;
        if (this._nodes && id in this._nodes && this._nodes[id]) {
            if ("channel_router" in window) {
                window.channel_router.navigate(this._nodes[id].path, {trigger: true});
            } else {
                window.location.href = "/learn/" + this._nodes[id].path;
            }
        } else {
            show_message("error", gettext("Unexpected error: no search data found for selected item. Please select another item."));
        }
        this.$("#search-box input").val("");
        return false;
    },

    input_changed: function() {
        if (this.$("#search").val() != "") {
           this.$("#search-button").removeAttr("disabled");
        }else {
           this.$("#search-button").attr('disabled', 'disabled');
        }
    },

    submit_form: function() {
        this.$("#search-box").submit();
    }
});

