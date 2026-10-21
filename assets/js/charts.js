/* Small SVG chart kit for ResQRoad analytics: area/line trends, grouped
   columns, donuts, horizontal bar lists, and sparklines. Every chart has an
   accessible label and a keyboard-free hover tooltip; values are also shown
   in legends or tables next to each chart. */
(function () {
  "use strict";

  let chartCount = 0;

  function escapeHtml(value) {
    return window.RoadWatchUI.escapeHtml(value);
  }

  function niceMax(value) {
    if (value <= 4) {
      return 4;
    }
    const magnitude = Math.pow(10, Math.floor(Math.log10(value)));
    const steps = [1, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10];
    for (let index = 0; index < steps.length; index += 1) {
      const candidate = steps[index] * magnitude;
      if (candidate >= value && Number.isInteger(candidate / 4)) {
        return candidate;
      }
    }
    return Math.ceil(value / 4) * 4;
  }

  // Monotone cubic interpolation keeps the curve from dipping below zero.
  function smoothPath(points) {
    if (points.length < 2) {
      return points.length ? "M" + points[0][0] + "," + points[0][1] : "";
    }
    const count = points.length;
    const dx = [];
    const slope = [];
    for (let index = 0; index < count - 1; index += 1) {
      dx[index] = points[index + 1][0] - points[index][0];
      slope[index] = (points[index + 1][1] - points[index][1]) / dx[index];
    }
    const tangent = [slope[0]];
    for (let index = 1; index < count - 1; index += 1) {
      tangent[index] = slope[index - 1] * slope[index] <= 0 ? 0 : (slope[index - 1] + slope[index]) / 2;
    }
    tangent[count - 1] = slope[count - 2];
    for (let index = 0; index < count - 1; index += 1) {
      if (slope[index] === 0) {
        tangent[index] = 0;
        tangent[index + 1] = 0;
      } else {
        const a = tangent[index] / slope[index];
        const b = tangent[index + 1] / slope[index];
        const sum = a * a + b * b;
        if (sum > 9) {
          const scale = 3 / Math.sqrt(sum);
          tangent[index] = scale * a * slope[index];
          tangent[index + 1] = scale * b * slope[index];
        }
      }
    }
    let path = "M" + points[0][0].toFixed(2) + "," + points[0][1].toFixed(2);
    for (let index = 0; index < count - 1; index += 1) {
      const step = dx[index] / 3;
      path +=
        " C" +
        (points[index][0] + step).toFixed(2) +
        "," +
        (points[index][1] + tangent[index] * step).toFixed(2) +
        " " +
        (points[index + 1][0] - step).toFixed(2) +
        "," +
        (points[index + 1][1] - tangent[index + 1] * step).toFixed(2) +
        " " +
        points[index + 1][0].toFixed(2) +
        "," +
        points[index + 1][1].toFixed(2);
    }
    return path;
  }

  function tooltipHtml(title, rows) {
    return (
      "<strong>" +
      escapeHtml(title) +
      "</strong>" +
      rows
        .map(function (row) {
          return (
            '<div class="chart-tooltip-row"><span><i class="swatch" style="background:' +
            row.color +
            '"></i>' +
            escapeHtml(row.name) +
            "</span><b>" +
            escapeHtml(row.value) +
            "</b></div>"
          );
        })
        .join("")
    );
  }

  function legendHtml(series) {
    return (
      '<ul class="chart-legend">' +
      series
        .map(function (item) {
          return '<li><i class="swatch" style="background:' + item.color + '"></i>' + escapeHtml(item.name) + "</li>";
        })
        .join("") +
      "</ul>"
    );
  }

  function gridAndAxis(width, height, pad, max) {
    let markup = "";
    for (let step = 0; step <= 4; step += 1) {
      const value = (max / 4) * step;
      const y = pad.top + (height - pad.top - pad.bottom) * (1 - step / 4);
      markup +=
        '<line class="chart-grid" x1="' +
        pad.left +
        '" x2="' +
        (width - pad.right) +
        '" y1="' +
        y +
        '" y2="' +
        y +
        '"></line><text class="chart-axis" x="' +
        (pad.left - 10) +
        '" y="' +
        (y + 4) +
        '" text-anchor="end">' +
        Math.round(value) +
        "</text>";
    }
    return markup;
  }

  function positionTooltip(container, tooltip, x, y) {
    const box = container.getBoundingClientRect();
    const half = tooltip.offsetWidth / 2;
    tooltip.style.left = Math.max(half, Math.min(box.width - half, x)) + "px";
    tooltip.style.top = Math.max(tooltip.offsetHeight + 12, y) + "px";
  }

  // Line/area trend. config: { labels, series: [{ name, color, values, fill }], height, ariaLabel }
  function area(container, config) {
    chartCount += 1;
    const id = "rr-chart-" + chartCount;
    const width = 640;
    const height = config.height || 250;
    const pad = { top: 16, right: 16, bottom: 30, left: 38 };
    const plotWidth = width - pad.left - pad.right;
    const plotHeight = height - pad.top - pad.bottom;
    const labels = config.labels;
    const max = niceMax(
      Math.max.apply(
        null,
        config.series.map(function (item) {
          return Math.max.apply(null, item.values.concat([0]));
        }),
      ),
    );

    function x(index) {
      return pad.left + (labels.length === 1 ? plotWidth / 2 : (index / (labels.length - 1)) * plotWidth);
    }
    function y(value) {
      return pad.top + plotHeight - (value / max) * plotHeight;
    }

    const defs = config.series
      .map(function (item, index) {
        return (
          '<linearGradient id="' +
          id +
          "-g" +
          index +
          '" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="' +
          item.color +
          '" stop-opacity="0.32"/><stop offset="1" stop-color="' +
          item.color +
          '" stop-opacity="0"/></linearGradient>'
        );
      })
      .join("");

    const paths = config.series
      .map(function (item, index) {
        const points = item.values.map(function (value, pointIndex) {
          return [x(pointIndex), y(value)];
        });
        const line = smoothPath(points);
        const fill = item.fill
          ? '<path d="' +
            line +
            " L" +
            x(labels.length - 1) +
            "," +
            (pad.top + plotHeight) +
            " L" +
            x(0) +
            "," +
            (pad.top + plotHeight) +
            ' Z" fill="url(#' +
            id +
            "-g" +
            index +
            ')" class="chart-area"></path>'
          : "";
        return (
          fill +
          '<path d="' +
          line +
          '" fill="none" stroke="' +
          item.color +
          '" stroke-width="2.75" stroke-linecap="round" stroke-linejoin="round" class="chart-line"' +
          (item.dashed ? ' stroke-dasharray="5 5"' : "") +
          "></path>"
        );
      })
      .join("");

    const labelMarkup = labels
      .map(function (label, index) {
        return (
          '<text class="chart-axis" x="' +
          x(index) +
          '" y="' +
          (height - 8) +
          '" text-anchor="middle">' +
          escapeHtml(label) +
          "</text>"
        );
      })
      .join("");

    const dots = config.series
      .map(function (item, index) {
        return (
          '<circle class="chart-hover-dot" data-series="' +
          index +
          '" r="5" fill="var(--surface)" stroke="' +
          item.color +
          '" stroke-width="2.5" opacity="0"></circle>'
        );
      })
      .join("");

    container.classList.add("chart");
    container.innerHTML =
      '<svg viewBox="0 0 ' +
      width +
      " " +
      height +
      '" role="img" aria-label="' +
      escapeHtml(config.ariaLabel || "Trend chart") +
      '"><defs>' +
      defs +
      "</defs>" +
      gridAndAxis(width, height, pad, max) +
      paths +
      '<line class="chart-guide" y1="' +
      pad.top +
      '" y2="' +
      (pad.top + plotHeight) +
      '" stroke="var(--border-strong)" stroke-width="1" opacity="0"></line>' +
      dots +
      labelMarkup +
      '<rect class="chart-hit" x="' +
      pad.left +
      '" y="' +
      pad.top +
      '" width="' +
      plotWidth +
      '" height="' +
      plotHeight +
      '" fill="transparent"></rect></svg><div class="chart-tooltip" aria-hidden="true"></div>';

    // Draw-in animation for each line.
    container.querySelectorAll(".chart-line").forEach(function (path) {
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches || !path.getTotalLength) {
        return;
      }
      const length = path.getTotalLength();
      path.style.strokeDasharray = path.getAttribute("stroke-dasharray") ? "" : length;
      if (!path.getAttribute("stroke-dasharray")) {
        path.style.strokeDashoffset = length;
        path.getBoundingClientRect();
        path.style.transition = "stroke-dashoffset 1.1s cubic-bezier(0.2, 0.8, 0.2, 1)";
        path.style.strokeDashoffset = "0";
      }
    });

    const svg = container.querySelector("svg");
    const hit = container.querySelector(".chart-hit");
    const guide = container.querySelector(".chart-guide");
    const tooltip = container.querySelector(".chart-tooltip");
    const hoverDots = container.querySelectorAll(".chart-hover-dot");

    function showAt(clientX) {
      const box = svg.getBoundingClientRect();
      const scale = width / box.width;
      const svgX = (clientX - box.left) * scale;
      const index = Math.max(
        0,
        Math.min(labels.length - 1, Math.round(((svgX - pad.left) / plotWidth) * (labels.length - 1))),
      );
      const gx = x(index);
      guide.setAttribute("x1", gx);
      guide.setAttribute("x2", gx);
      guide.setAttribute("opacity", "1");
      let topY = height;
      hoverDots.forEach(function (dot) {
        const series = config.series[Number(dot.dataset.series)];
        const dy = y(series.values[index]);
        topY = Math.min(topY, dy);
        dot.setAttribute("cx", gx);
        dot.setAttribute("cy", dy);
        dot.setAttribute("opacity", "1");
      });
      tooltip.innerHTML = tooltipHtml(
        (config.tooltipLabels || labels)[index],
        config.series.map(function (series) {
          return { name: series.name, color: series.color, value: series.values[index] };
        }),
      );
      tooltip.classList.add("is-visible");
      positionTooltip(container, tooltip, gx / scale, topY / scale);
    }

    hit.addEventListener("pointermove", function (event) {
      showAt(event.clientX);
    });
    hit.addEventListener("pointerleave", function () {
      guide.setAttribute("opacity", "0");
      hoverDots.forEach(function (dot) {
        dot.setAttribute("opacity", "0");
      });
      tooltip.classList.remove("is-visible");
    });
  }

  function barPath(x, y, width, height, radius) {
    if (height <= 0) {
      return "";
    }
    const r = Math.min(radius, width / 2, height);
    return (
      "M" + x + "," + (y + height) +
      " V" + (y + r) +
      " Q" + x + "," + y + " " + (x + r) + "," + y +
      " H" + (x + width - r) +
      " Q" + (x + width) + "," + y + " " + (x + width) + "," + (y + r) +
      " V" + (y + height) + " Z"
    );
  }

  // Grouped columns. config: { labels, series: [{ name, color, values }], height, ariaLabel }
  function columns(container, config) {
    const width = 640;
    const height = config.height || 250;
    const pad = { top: 16, right: 12, bottom: 30, left: 38 };
    const plotWidth = width - pad.left - pad.right;
    const plotHeight = height - pad.top - pad.bottom;
    const labels = config.labels;
    const band = plotWidth / labels.length;
    const seriesCount = config.series.length;
    const barWidth = Math.min(22, (band * 0.62) / seriesCount);
    const groupWidth = barWidth * seriesCount + (seriesCount - 1) * 4;
    const max = niceMax(
      Math.max.apply(
        null,
        config.series.map(function (item) {
          return Math.max.apply(null, item.values.concat([0]));
        }),
      ),
    );

    let bars = "";
    let hits = "";
    labels.forEach(function (label, index) {
      const start = pad.left + band * index + (band - groupWidth) / 2;
      config.series.forEach(function (series, seriesIndex) {
        const value = series.values[index] || 0;
        const barHeight = (value / max) * plotHeight;
        const bx = start + seriesIndex * (barWidth + 4);
        bars +=
          '<path class="chart-bar" style="animation-delay:' +
          index * 45 +
          'ms" d="' +
          barPath(bx, pad.top + plotHeight - barHeight, barWidth, barHeight, 5) +
          '" fill="' +
          series.color +
          '"></path>';
      });
      hits +=
        '<rect class="chart-band" data-index="' +
        index +
        '" x="' +
        (pad.left + band * index) +
        '" y="' +
        pad.top +
        '" width="' +
        band +
        '" height="' +
        plotHeight +
        '" rx="8"></rect>';
    });

    const labelMarkup = labels
      .map(function (label, index) {
        return (
          '<text class="chart-axis" x="' +
          (pad.left + band * index + band / 2) +
          '" y="' +
          (height - 8) +
          '" text-anchor="middle">' +
          escapeHtml(label) +
          "</text>"
        );
      })
      .join("");

    container.classList.add("chart");
    container.innerHTML =
      '<svg viewBox="0 0 ' +
      width +
      " " +
      height +
      '" role="img" aria-label="' +
      escapeHtml(config.ariaLabel || "Column chart") +
      '">' +
      gridAndAxis(width, height, pad, max) +
      '<g class="chart-bands">' +
      hits +
      "</g>" +
      bars +
      labelMarkup +
      '</svg><div class="chart-tooltip" aria-hidden="true"></div>';

    const svg = container.querySelector("svg");
    const tooltip = container.querySelector(".chart-tooltip");
    container.querySelectorAll(".chart-band").forEach(function (rect) {
      rect.addEventListener("pointerenter", function () {
        const index = Number(rect.dataset.index);
        const box = svg.getBoundingClientRect();
        const scale = width / box.width;
        rect.classList.add("is-hover");
        tooltip.innerHTML = tooltipHtml(
          (config.tooltipLabels || labels)[index],
          config.series.map(function (series) {
            return { name: series.name, color: series.color, value: series.values[index] || 0 };
          }),
        );
        tooltip.classList.add("is-visible");
        const tallest = Math.max.apply(
          null,
          config.series.map(function (series) {
            return series.values[index] || 0;
          }),
        );
        positionTooltip(
          container,
          tooltip,
          (pad.left + band * index + band / 2) / scale,
          (pad.top + plotHeight - (tallest / max) * plotHeight) / scale,
        );
      });
      rect.addEventListener("pointerleave", function () {
        rect.classList.remove("is-hover");
        tooltip.classList.remove("is-visible");
      });
    });
  }

  // Donut with a legend. segments: [{ label, value, color }]
  function donut(container, segments, options) {
    const total = segments.reduce(function (sum, segment) {
      return sum + segment.value;
    }, 0);
    const radius = 60;
    const circumference = 2 * Math.PI * radius;
    const gap = segments.filter(function (segment) {
      return segment.value > 0;
    }).length > 1 ? 3 : 0;
    let offset = 0;
    const rings = segments
      .map(function (segment, index) {
        const length = total ? (segment.value / total) * circumference : 0;
        const visible = Math.max(0, length - gap);
        const ring =
          '<circle class="donut-segment" data-index="' +
          index +
          '" cx="80" cy="80" r="' +
          radius +
          '" fill="none" stroke="' +
          segment.color +
          '" stroke-width="18" stroke-linecap="butt" stroke-dasharray="' +
          visible.toFixed(2) +
          " " +
          (circumference - visible).toFixed(2) +
          '" stroke-dashoffset="' +
          (-offset).toFixed(2) +
          '"><title>' +
          escapeHtml(segment.label + ": " + segment.value) +
          "</title></circle>";
        offset += length;
        return ring;
      })
      .join("");
    const legend = segments
      .map(function (segment, index) {
        const percentage = total ? Math.round((segment.value / total) * 100) : 0;
        return (
          '<li data-index="' +
          index +
          '"><i class="swatch" style="background:' +
          segment.color +
          '"></i><span>' +
          escapeHtml(segment.label) +
          "</span><strong>" +
          segment.value +
          '</strong><span class="pct">' +
          percentage +
          "%</span></li>"
        );
      })
      .join("");

    container.classList.add("donut");
    container.innerHTML =
      '<svg viewBox="0 0 160 160" role="img" aria-label="' +
      escapeHtml((options && options.ariaLabel) || "Distribution chart") +
      '"><circle cx="80" cy="80" r="' +
      radius +
      '" fill="none" stroke="var(--surface-3)" stroke-width="18"></circle><g transform="rotate(-90 80 80)">' +
      rings +
      '</g><text class="donut-total" x="80" y="84">' +
      total +
      '</text><text class="donut-label" x="80" y="102">' +
      escapeHtml((options && options.centerLabel) || "Total") +
      '</text></svg><ul class="donut-legend">' +
      legend +
      "</ul>";

    function highlight(index) {
      container.querySelectorAll(".donut-segment").forEach(function (segment) {
        segment.classList.toggle("is-hover", Number(segment.dataset.index) === index);
      });
    }
    container.querySelectorAll(".donut-legend li, .donut-segment").forEach(function (element) {
      element.addEventListener("pointerenter", function () {
        highlight(Number(element.dataset.index));
      });
      element.addEventListener("pointerleave", function () {
        highlight(-1);
      });
    });
  }

  // Horizontal bars. items: [{ label, value, tone, display }]
  function barList(container, items, options) {
    const max =
      (options && options.max) ||
      Math.max.apply(
        null,
        items
          .map(function (item) {
            return item.value;
          })
          .concat([1]),
      );
    if (items.length === 0) {
      container.innerHTML = '<p class="muted text-sm">' + escapeHtml((options && options.empty) || "No data yet.") + "</p>";
      return;
    }
    container.innerHTML =
      '<ul class="bar-list">' +
      items
        .map(function (item, index) {
          return (
            '<li><div class="bar-list-head"><span>' +
            escapeHtml(item.label) +
            "</span><strong>" +
            escapeHtml(item.display != null ? item.display : item.value) +
            '</strong></div><div class="bar-track"><div class="bar-fill" style="--value:' +
            ((item.value / max) * 100).toFixed(1) +
            "%;" +
            (item.tone ? "--tone:" + item.tone + ";" : "") +
            "animation-delay:" +
            index * 60 +
            'ms"></div></div></li>'
          );
        })
        .join("") +
      "</ul>";
  }

  function sparkline(values, color) {
    const width = 200;
    const height = 44;
    const max = Math.max.apply(null, values.concat([1]));
    const points = values.map(function (value, index) {
      return [
        (index / Math.max(1, values.length - 1)) * width,
        height - 4 - (value / max) * (height - 10),
      ];
    });
    chartCount += 1;
    const id = "rr-spark-" + chartCount;
    const line = smoothPath(points);
    return (
      '<svg class="kpi-spark" viewBox="0 0 ' +
      width +
      " " +
      height +
      '" preserveAspectRatio="none" aria-hidden="true"><defs><linearGradient id="' +
      id +
      '" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="' +
      color +
      '" stop-opacity="0.22"/><stop offset="1" stop-color="' +
      color +
      '" stop-opacity="0"/></linearGradient></defs><path d="' +
      line +
      " L" +
      width +
      "," +
      height +
      " L0," +
      height +
      ' Z" fill="url(#' +
      id +
      ')"></path><path d="' +
      line +
      '" fill="none" stroke="' +
      color +
      '" stroke-width="2" vector-effect="non-scaling-stroke" stroke-linecap="round"></path></svg>'
    );
  }

  window.RoadWatchCharts = {
    area: area,
    columns: columns,
    donut: donut,
    barList: barList,
    sparkline: sparkline,
    legendHtml: legendHtml,
  };
})();
