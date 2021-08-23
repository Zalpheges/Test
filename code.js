dayjs.locale('fr');
const startOfDay = dayjs().startOf('day');
const endOfDay = dayjs().endOf('day');
const endOfWeek = dayjs().endOf("week");
const oneWeekAgo = endOfDay.clone().subtract(1, 'weeks');
const oneMonthAgo = endOfDay.clone().subtract(1, 'months');
const threeMonthAgo = endOfDay.clone().subtract(3, 'months');
const sixMonthAgo = endOfDay.clone().subtract(6, 'months');

var raw, records, chart, weight, map, option = 0, data;

function howManyDaysAgo(date) {
  return endOfDay.diff(date, 'days');
}

function howManyWeeksAgo(date) {
  return endOfWeek.diff(date, 'weeks');
}

function weekLabel(date) {
  let from = date.startOf('week');

  let fromDate = from.date();
  let fromMonth = from.format('MMM');

  let to = date.endOf('week');

  let toDate = to.date();
  let toMonth = to.format('MMM');

  if (fromMonth == toMonth) return fromDate + ' - ' + toDate + ' ' + toMonth;
  else return fromDate + ' ' + fromMonth + ' - ' + toDate + ' ' + toMonth;
}

function formatRecord(record) {
  let splitted = record.split('_');

  return {
    date: dayjs(splitted[0], 'YYYY-MM-DD'),
    weight: Number(splitted[1]),
    note: splitted[2]
  }
}

function formatRecords(records) {
  if (records.charAt(records.length - 1) == '/')
    records = records.slice(0, -1);

  return records.split('/').map(record => formatRecord(record));
}

function mapRecords(records) {
  let mapped = records.reduce((acc, value) => {
    let week = howManyWeeksAgo(value.date);
    if (!acc[week]) acc[week] = {
      label: weekLabel(value.date),
      records: []
    };

    acc[week].records.push(value);

    return acc;
  }, {});

  const keys = Object.keys(mapped);

  for (let i = 0; i < keys.length; i++) {
    mapped[keys[i]].records.sort((a, b) => a.date.isBefore(b.date));
  }

  for (let i = 0, j; i < keys.length; i++) {
    let key = keys[i];

    for (j = 0; j < mapped[key].records.length - 1; j++) {
      mapped[key].records[j].progress = Number((mapped[key].records[j].weight - mapped[key].records[j + 1].weight).toFixed(2));
    }
  }

  for (let i = keys.length - 1; i >= 0; i--) {
    let key = keys[i];

    mapped[key].average = mapped[key].records.reduce((acc, value) => acc + value.weight, 0);
    mapped[key].average = Number((mapped[key].average / mapped[key].records.length).toFixed(2));
  }

  for (let i = 0; i < keys.length - 1; i++) {
    mapped[keys[i]].progress = Number((mapped[keys[i]].average - mapped[keys[i + 1]].average).toFixed(2));
  }

  return mapped;
}

function computePoints(weekly, labelizeYear) {
  const keys = Object.keys(map);

  if (keys.length < 1) return { points: [], labels: [] };

  let points = [], labels = [];
  let length = Math.max(...keys);

  if (weekly) {
    for (let i = 0; i <= length; i++) {
      if (keys.includes(i.toString())) points.push(map[i.toString()].average);
      else points.push(NaN);

      if (labelizeYear) labels.push(weekLabel(dayjs().subtract(i, 'weeks')) + ' ' + dayjs().subtract(i, 'weeks').year());
      else labels.push(weekLabel(dayjs().subtract(i, 'weeks')));
    }
  }
  else {
    let last = map[keys[keys.length -  1]].records[map[keys[keys.length -  1]].records.length - 1].date;
    let ago = howManyDaysAgo(last);

    let today = dayjs();
    for (let i = 0, day, week, value, sum = 0; i <= ago; i++) {
      day = today.subtract(i, 'days');
      week = howManyWeeksAgo(day);

      let record;
      if (keys.includes(week.toString())) record = map[week.toString()].records.find(_record => _record.date.isSame(day, 'day'));

      if (record) points.push(record.weight);
      else points.push(NaN);

      if (i == 0) labels.push('Aujourd\'hui');
      else if (i == 1) labels.push('Hier');
      else labels.push('Il y a ' + i + ' jours');
    }
  }

  points.reverse();
  labels.reverse();

  let mean = [];
  for (let i = 0, sum = 0, count = 0; i < points.length; i++) {
    if (isNaN(points[i])) mean.push(mean[mean.length - 1]);
    else {
      sum += points[i];
      mean.push(Number((sum / (count++ + 1)).toFixed(2)));
    }
  }

  return { points: points, labels: labels, mean: mean };
}

function add(date, weight, note) {
  let index = records.findIndex(record => dayjs(date).isSame(dayjs(), 'day'));

  if (index != -1) {
    records[index].weight = weight;
    records[index].note = note;
  }
  else records.push({ date: dayjs(date), weight: weight, note: note });
}

function init() {
  let _records;

  if (option == 0) _records = records.filter(record => record.date.isAfter(oneWeekAgo));
  else if (option == 1) _records = records.filter(record => record.date.isAfter(oneMonthAgo));
  else if (option == 2) _records = records.filter(record => record.date.isAfter(threeMonthAgo));
  else if (option == 3) _records = records.filter(record => record.date.isAfter(sixMonthAgo));
  else if (option == 4) _records = records;

  map = mapRecords(_records);

  let data = computePoints(option != 0, option == 4);

  console.log(map);
  console.log('Initiated with option ' + option);

  return data;
}

function draw() {
  if (chart) chart.destroy();

  let _points = data.points.slice().reverse();
  const getColor = (ctx, down, up, constant) => {
    let p0 = ctx.p0.skip ? _points.slice(data.points.length - 1 - ctx.p0DataIndex + 1, _points.length).find(value => !isNaN(value)) : ctx.p0.parsed.y;
    let p1 = ctx.p1.skip ? data.points.slice(ctx.p1DataIndex + 1, data.points.length).find(value => !isNaN(value)) : ctx.p1.parsed.y;
    if (p0 == p1) return constant;
    else return p0 > p1 ? down : up;
  }

  chart = new Chart(document.getElementById('w_chart'), {
    type: 'line',
    data: {
      labels: data.labels,
      datasets: [{
      label: 'Weight',
      data: data.points,
      segment: {
        borderColor: ctx => getColor(ctx, 'rgb(75,192,192)', 'rgb(192,75,75)', 'rgb(85,147,181)'),
        borderDash: ctx => ctx.p0.skip || ctx.p1.skip ? [6, 6] : undefined,
      },
      backgroundColor: 'rgb(85,147,181)',
      pointRadius: 1,
      }, {
        label: 'Mean',
      data: data.mean,
      segment: {
        borderColor: ctx => getColor(ctx, 'rgb(75,192,192,0.5)', 'rgb(192,75,75, 0.5)', 'rgb(85,147,181,0.5)'),
        borderDash: ctx => ctx.p0.skip || ctx.p1.skip ? [6, 6] : undefined,
      },
      pointRadius: 0,
      borderWidth: 1
      }]
    },
    options: {
        interaction: {
          intersect: false,
          mode: 'index',
        },
        scales: {
          x: {
            ticks: {
                autoSkip: true,
                maxTicksLimit: 20
            }
          }
        }
          }
  });
}

window.addEventListener('DOMContentLoaded', function() {
  let raw = '', today = dayjs(), weight = 65;
  for (let i = 0; i < 10000; i += Math.random() > 0.2 ? 1 : 2) {
    weight += Math.random() * 0.5 * (Math.random() < 0.5 ? -1 : 1);
    let content = today.subtract(i, 'days').format('YYYY-MM-DD') + '_' + weight.toFixed(2) + '_' + 'blablabla/';
    if ((raw + content).length > 100000) {
      console.log(raw);
      raw = content;
    }
    else raw += content;
  }

  records = formatRecords(raw);
  console.log(records);

  document.getElementById('options').value = 0;
  document.getElementById('options').addEventListener('input', event => {
    option = Number(event.target.value);

    data = init();
    draw();
  });

  data = init();
  draw();

  document.getElementById('add').addEventListener('click', function() {
    add('2021-08-22', 80, '80 !');

    data = init();
    draw();
  });
});
