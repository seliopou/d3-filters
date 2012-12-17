(function() {

/* BEGIN PRIVATE APIs ======================================================= */

/*
* Lookup table for the `kind`s of supported inputs. Given a selection an the
* value associated with the input, return a result that can be used as an
* input for SVG Filter elements:
*
*   http://www.w3.org/TR/SVG11/filters.html#FilterPrimitiveInAttribute
*/
var kind = {};
kind.id = function(v, result) {
  return kind.url('#' + v, result);
};
kind.in = function(v) {
  /* Works for special results, e.g., SourceGraphic, BackgroundImage, etc. */
  return function(selection) {
    return v;
  }
};
kind.url = function(v, result) {
  return function(selection) {
    return selection.append('feImage')
      .attr('xlink:href', v)
      .attr('result', result ? result : 'result_' + unique())
      .attr('result');
  }
};

var unique = (function() {
  var counter = 0;

  return function() {
    return counter++;
  };
})();

function resultFor(d, r) {
  return kind[d.kind](d.value, r);
};

/*
 * This is a fold creator for composite operations. `_spine` is used as the
 * combining function in the fold, but the rest is handled by the function
 * returned by _chain.
 */
 function _chain(_spine) {
  return function() {
    var inputs = [],
        result = null,
        /* The result of a call to `_spine` should be a function with
         * the following type:
         *
         *   spine :: (selection -> string, selection -> string, bool)
         *         -> (selection -> string)
         * 
         * ... where `selection` is a d3 selection and `a` is a type variable.
         * The bool argument to `spine` indicates whether this is the final
         * application of the combining function in the fold, the intended use
         * of which is to assign a user-provided result to the composite
         * operation, if one is specified. The `string` results should be a
         * result that can be referenced by subsequent SVG filter operations.
         */
        spine  = _spine.call(null, Array.prototype.slice.call(arguments)); 

    var my = function(selection) {
      if (inputs.length > 0) {
        var first = inputs[0],
            rest  = inputs.slice(1);

        rest.reduce(function(acc, d, idx) {
          return spine(acc, resultFor(d), (rest.length - 1 == idx) && result)
        }, resultFor(first, (rest.length == 0) && result))(selection);
      }

      return selection;
    };

    /* Add an SVG element to the composite */
    my.id = function(ident) {
      inputs.push({ 'kind' : 'id', 'value' : ident });
      return  my;
    };

    /* Add an external resource to the composite */
    my.url = function(url) {
      inputs.push({ 'kind' : 'url', 'value' : url});
      return my;
    }

    /* Add the result of a filter to the composite */
    my.in = function(result) {
      inputs.push({ 'kind' : 'in', 'value' : result });
      return my;
    };

    /* Get or set the result name of this composite */
    my.result = function(res) {
        if (arguments.length == 0) { return result; }
        result = res;
        return my;
    };

    return my;
  };
};

var composite = _chain(function(op, k1, k2, k3, k4) {
  return function(inn, inn2, r) {
    return function(selection) {
      /* 
       * NB: The `r` parameter for the result geneators should be false for both
       * of these calls. Since we're in a call to compose, they're clearly not
       * the result generators to be called.
       *
       * NB: These calls must occur before the creation of feComposite element, 
       * forward result references are an error in SVG.
       *
       *   http://www.w3.org/TR/SVG/filters.html#FilterPrimitiveInAttribute
       */
      var innv  = inn(selection),
          innv2 = inn2(selection);

      return selection.append('feComposite')
        .attr('in', innv)
        .attr('in2', innv2)
        .attr('operator', op)
        .attr('k1', k1)
        .attr('k2', k2)
        .attr('k3', k3)
        .attr('k4', k4)
        .attr('result', r ? r : 'result_' + unique())
        .attr('result');
    };
  };
});

var blend = _chain(function(mode) {
  return function(inn, inn2, r) {
    return function(selection) {
      var innv  = inn(selection),
          innv2 = inn2(selection);

      return selection.append('feBlend')
        .attr('in', innv)
        .attr('in2', innv2)
        .attr('mode', mode)
        .attr('result', r ? r : 'result_' + unique())
        .attr('result');
    };
  };
});

/* BEGIN PUBLIC APIs ======================================================== */


d3.filters = {
  'composite' : {},
  'blend' : {},
};

d3.filters.composite.over = function() {
  return composite('over');
};

d3.filters.composite.in = function() {
  return composite('in');
};

d3.filters.composite.out = function() {
  return composite('out');
};

d3.filters.composite.xor = function() {
  return composite('xor');
};

d3.filters.composite.atop = function() {
  return composite('atop');
};

d3.filters.composite.arithmetic = function(k1, k2, k3, k4) {
  return composite('arithmetic', k1, k2, k3, k4);
};

d3.filters.blend.normal = function() {
    return blend('normal');
}

d3.filters.blend.multiply = function() {
    return blend('multiply');
}

d3.filters.blend.screen = function() {
    return blend('screen');
}

d3.filters.blend.darken = function() {
    return blend('darken');
}

d3.filters.blend.lighten = function() {
    return blend('lighten');
}

d3.filters.merge = function() {
  var inputs = [],
      result = null;

  var my = function(selection) {
    var results = inputs.slice().reverse().map(function(d) {
      return resultFor(d)(selection);
    });

    selection.append('feMerge')
        .attr('result', result)
      .selectAll('nodes')
        .data(results)
      .enter().append('feMergeNode')
        .attr('in', function(d) { return d; });

    return selection;
  };

  /* Add an SVG element to the composite */
  my.id = function(ident) {
    inputs.push({ 'kind' : 'id', 'value' : ident });
    return  my;
  };

  /* Add an external resource to the composite */
  my.url = function(url) {
    inputs.push({ 'kind' : 'url', 'value' : url});
    return my;
  }

  /* Add the result of a filter to the composite */
  my.in = function(result) {
    inputs.push({ 'kind' : 'in', 'value' : result });
    return my;
  };

  /* Get or set the result name of this composite */
  my.result = function(res) {
      if (arguments.length == 0) { return result; }
      result = res;
      return my;
  };

  return my;
};

})();
