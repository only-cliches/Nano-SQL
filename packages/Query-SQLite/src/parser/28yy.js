/*
//
// Parser helper for Alasql.js
// Date: 03.11.2014
// (c) 2014, Andrey Gershun
//
*/

function returnUndefined() {}

module.exports = {
	fn: function(yy) {

		yy.extend = function(a, b) {
			a = a || {};
			for (var key in b) {
				if (b.hasOwnProperty(key)) {
					a[key] = b[key];
				}
			}
			return a;
		};
		// Option for case sensitive
		yy.casesensitive = false;

		var extendWrapper = function (params) {
			return yy.extend(this, params);
		};

		yy.FuncValue = extendWrapper;
		yy.Statements = extendWrapper;
		yy.Select = extendWrapper;
		yy.ExpressionStatement = extendWrapper;
		yy.Column = extendWrapper;
		yy.Table = extendWrapper;
		yy.Insert = extendWrapper;
		yy.Op = extendWrapper;
		yy.Join = extendWrapper;
		yy.AggrValue = extendWrapper;
		yy.WithSelect = extendWrapper;
		yy.Search = extendWrapper;
		yy.Json = extendWrapper;
		yy.StringValue = extendWrapper;
		yy.SetColumn = extendWrapper;
		yy.Delete = extendWrapper;
		yy.Apply = extendWrapper;
		yy.Delete = extendWrapper;
		yy.Expression = extendWrapper;
		yy.GroupExpression = extendWrapper;
		yy.DomainValueValue = extendWrapper;
		yy.JavaScript = extendWrapper;
		yy.Convert = extendWrapper;
		yy.Over = extendWrapper;
		yy.NumValue = extendWrapper;
		yy.LogicValue = extendWrapper;
		yy.NullValue = extendWrapper;
		yy.ArrayValue = extendWrapper;
		yy.ParamValue = extendWrapper;
		yy.VarValue = extendWrapper;
		yy.ExistsValue = extendWrapper;
		yy.CaseValue = extendWrapper;
		yy.UniOp = extendWrapper;
		yy.Reindex = extendWrapper;
		yy.DropTrigger = extendWrapper;
		yy.CreateTrigger = extendWrapper;
		yy.Term = extendWrapper;
		yy.AddRule = extendWrapper;
		yy.CreateEdge = extendWrapper;
		yy.CreateGraph = extendWrapper;
		yy.CreateVertex = extendWrapper;
		yy.TruncateTable = extendWrapper;
		yy.Merge = extendWrapper;
		yy.Echo = extendWrapper;
		yy.Declare = extendWrapper;
		yy.Require = extendWrapper;
		yy.Print = extendWrapper;
		yy.BeginEnd = extendWrapper;
		yy.Break = extendWrapper;
		yy.Continue = extendWrapper;
		yy.While = extendWrapper;
		yy.If = extendWrapper;
		yy.CommitTransaction = extendWrapper;
		yy.RollbackTransaction = extendWrapper;
		yy.BeginTransaction = extendWrapper;
		yy.SetVariable = extendWrapper;
		yy.Assert = extendWrapper;
		yy.Source = extendWrapper;
		yy.ExpressionStatement = extendWrapper;
		yy.DropTable = extendWrapper;
		yy.CreateTable = extendWrapper;
		yy.ShowCreateTable = extendWrapper;
		yy.ShowIndex = extendWrapper;
		yy.ShowColumns = extendWrapper;
		yy.ShowTables = extendWrapper;
		yy.ShowDatabases = extendWrapper;
		yy.DropIndex = extendWrapper;
		yy.CreateIndex = extendWrapper;
		yy.DropDatabase = extendWrapper;
		yy.UseDatabase = extendWrapper;
		yy.DetachDatabase = extendWrapper;
		yy.AttachDatabase = extendWrapper;
		yy.AlterTable = extendWrapper;
		yy.ColumnDef = extendWrapper;


		// Base class for all yy classes
		var Base = (yy.Base = function (params) {
			return yy.extend(this, params);
		});
/*
		Base.prototype.toString = function () {};
		Base.prototype.toType = function () {};
		Base.prototype.toJS = function () {};

		//  var BaseClause = yy,BaseClause = function (params) { return yy.extend(this, params); };
		// Base.prototype.compile = returnUndefined;
		Base.prototype.exec = function () {};

		//  var BaseStatement = yy,BaseStatement = function (params) { return yy.extend(this, params); };
		// Base.prototype.compile = returnUndefined;
		Base.prototype.exec = function () {};*/

	}
};