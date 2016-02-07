(function (root, factory) {
    if (typeof define === "function" && define.amd) {
        define(["d3", "src/layout/Border", "src/layout/Grid", "src/form/Form", "src/chart/Column", "src/other/Table", "src/common/WidgetArray", "src/form/Input", "src/form/Button", "es6-promise"], factory);
    }
}(this, function (d3, Border, Grid, Form, Column, Table, WidgetArray, Input, Button) {
    var issues;

    function Main(db, filters, series, aggregates) {
        Border.call(this);

        function MilestoneColumn() {
            Column.call(this);
        }
        MilestoneColumn.prototype = Object.create(Column.prototype);

        MilestoneColumn.prototype.publish("org", "", "string");
        MilestoneColumn.prototype.publish("repo", "", "string");
        MilestoneColumn.prototype.publish("title", "", "string");
        MilestoneColumn.prototype.publish("issues", [], "array");

        var context = this;
        MilestoneColumn.prototype.click = function (row, col, sel) {
            var columnContext = this;
            context.fetchIssues(this.org(), this.repo(), row.__lparam).then(function (issues) {
                columnContext.issues(issues.map(function (issue) {
                    return [columnContext.repo(), "<a href='" + issue.html_url + "' target='_blank'>#" + issue.number + "</div>", issue.title, issue.created_at, issue.updated_at, issue];
                }));
                context._table.refresh();
            });
        };

        this.topShrinkWrap(true);

        this._form = new Form()
            .showSubmit(true)
            .inputs([
                new WidgetArray()
                    .content([
                        new Input()
                            .name("id")
                            .label("GitHub ID")
                            .type("text")
                            .value(""),
                        new Input()
                            .name("pw")
                            .label("Password")
                            .type("password")
                            .value(""),
                    ])
            ])
        ;
        this._form.click = function (row) {
            context.loadIssues(row.id, row.pw);
        };

        this.setContent("top", this._form);

        this._grid = new Grid();
        this.setContent("center", this._grid);


        this._dsp = new MilestoneColumn()
            .org("hpcc-systems")
            .repo("DSP")
            .columns(["DSP", "Milestones"])
        ;
        this._grid.setContent(0, 0, this._dsp, "DSP");

        this._hipie = new MilestoneColumn()
            .org("hpcc-systems")
            .repo("HIPIE")
            .columns(["HIPIE", "Milestones"])
        ;
        this._grid.setContent(0, 1, this._hipie, "HIPIE");

        this._viz = new MilestoneColumn()
            .org("hpcc-systems")
            .repo("Visualization")
            .columns(["HPCC-Viz", "Milestones"])
        ;
        this._grid.setContent(0, 2, this._viz, "HPCC-Viz");

        this._table = new Table()
            .sortByFieldIndex(4)
            .descending(true)
            .renderHtmlDataCells(true)
            .columns(["Repository", "Issue", "Title", "Created", "Updated"])
            .on("click", function (row, col, sel) {
            });
        ;
        this._table.refresh = function () {
            delete this._prevSortByFieldIndex;
            delete this._prevDescending;
            this
                .data(context._dsp.issues().concat(context._hipie.issues().concat(context._viz.issues())))
                .render()
            ;
        };
        this._grid.setContent(1, 0, this._table, "HPCC-Viz", 3, 3);
    }
    Main.prototype = Object.create(Border.prototype);
    Main.prototype.constructor = Main;

    Main.prototype.loadIssues = function (id, pw) {
        this._github = new Github({
            username: id,
            password: pw,
            auth: "basic"
        });

        var context = this;
        function procData(_issues) {
            var issues = _issues.filter(function (issue) {
                return issue.pull_request === undefined;
            });

            var vertices = [];
            var edges = [];
            var verticesIdx = {};
            issues.forEach(function (issue) {
                var vertex = new Vertex()
                    .faChar("\uf188")
                    .text(issue.title)
                ;
                vertices.push(vertex);
                verticesIdx["i:" + issue.title] = vertex;
            });

            context._byUser = d3.nest()
                .key(function (d) {
                    if (d.assignee) {
                        console.log(d.assignee.login);
                        return d.assignee.login;
                    }
                    return "unassigned";
                })
                .entries(issues)
            ;
            context._byUser.forEach(function (user) {
                var vertex = new Vertex()
                    .faChar("\uf007")
                    .text(user.key)
                ;
                vertices.push(vertex);
                verticesIdx["u:" + user.key] = vertex;
                user.values.forEach(function (issue) {
                    var edge = new Edge()
                        .sourceVertex(vertex)
                        .targetVertex(verticesIdx["i:" + issue.title])
                    ;
                    edges.push(edge);
                });
            });
            context._people.data(context._byUser.map(function (d) { return [d.key, d.values.length]; }))
                .render()
            ;

            context._byMilestone = d3.nest()
                .key(function (d) {
                    if (d.milestone) {
                        return d.milestone.title;
                    }
                    return "none";
                })
                .entries(issues)
            ;
            context._byMilestone.forEach(function (milestone) {
                var vertex = new Vertex()
                    .faChar("\uf274")
                    .text(milestone.key)
                ;
                vertices.push(vertex);
                verticesIdx["m:" + milestone.key] = vertex;
                milestone.values.forEach(function (issue) {
                    var edge = new Edge()
                        .sourceVertex(vertex)
                        .targetVertex(verticesIdx["i:" + issue.title])
                    ;
                    edges.push(edge);
                });
            });
            context._milestones.data(context._byMilestone.map(function (d) { return [d.key, d.values.length]; }))
                .render()
            ;

            context._graph
                .data({ vertices: vertices, edges: edges })
                .layout("ForceDirected")
                .applyScaleOnLayout(true)
                .render()
            ;
        }

        var context = this;
        if (issues) {
            procData(issues);
        } else {
            Promise.all([
                this.primeMilestones("hpcc-systems", "Visualization", "1.10.0", this._viz),
                this.primeMilestones("hpcc-systems", "DSP", "DSP 1.5.1", this._dsp),
                this.primeMilestones("hpcc-systems", "HIPIE", "1.6.2", this._hipie)
            ]).then(function (allIssues) {
                var issues = []
                allIssues.forEach(function (_issues) {
                    issues = issues.concat(_issues);
                });
                //procData(issues);
            }).catch(function (e) {
                console.log(e);
            });
        }
    };

    Main.prototype.primeMilestones = function (org, repo, milestone, widget) {
        var context = this;
        return new Promise(function (resolve, reject) {
            var milestoneIdx = {};
            var gitMilestones = context._github.getMilestones(org, repo);
            gitMilestones.list({}, function (err, milestones) {
                milestones.forEach(function (milestone) {
                    milestoneIdx[milestone.title] = milestone;
                });
                widget
                    .data(milestones.map(function (milestone) {
                        return [milestone.title, milestone.open_issues, milestone];
                    }))
                    .render(function (w) {
                        resolve();
                    });
                ;
            });
        });
    };

    Main.prototype.fetchIssues = function (org, repo, milestone) {
        var context = this;
        return new Promise(function (resolve, reject) {
            var gitIssues = context._github.getIssues(org, repo);
            gitIssues.list({ milestone: milestone.number }, function (err, issues) {
                resolve(issues);
            });
        });
    };

    Main.prototype.doResize = Main.prototype.debounce(function (mainDiv) {
        mainDiv.style.width = window.innerWidth - 16 + "px";
        mainDiv.style.height = window.innerHeight - 16 + "px";
        this
            .resize()
            .render()
        ;
    }, 250)

    return Main;
}));