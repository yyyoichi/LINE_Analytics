const ACCESS_TOKEN = "【LINE_ACCESS_TOKEN】";

function init() {
  //毎日9時にレポートを出力する
  ScriptApp.newTrigger('main').timeBased().atHour(9).everyDays(1).create();
}

//最初にメッセージを送ったユーザーIDを取得する
function doPost(e) {
  //すでにuserIdが存在していれば何もしない
  if (PropertiesService.getScriptProperties().getProperty('to')) return ;
  const responseLine = e.postData.getDataAsString();

  const event = JSON.parse(responseLine).events[0];
  const userID = event.source.userId;
  PropertiesService.getScriptProperties().setProperty('to', userID);
  
}

function main() {
  const to = PropertiesService.getScriptProperties().getProperty('to');
  if(!to)return ;
  const lists = getLists();
  for (let i = 0; i < lists.length; i++) {
    const messages = createMessages(lists[i]);
    postLine(messages, to);
  }
}

//line にメッセージを送る
function postLine(messages, to) {
  const url = "https://api.line.me/v2/bot/message/push";
  const headers = {
    "Content-Type": "application/json; charset=UTF-8",
    'Authorization': 'Bearer ' + ACCESS_TOKEN,
  };
  
  
  const payload = { to , messages };
  const options = {
    "method": "post",
    headers,
    "payload": JSON.stringify(payload)
  };
  try{
    UrlFetchApp.fetch(url, options);
  }catch(e){
    console.log(e);
  }
}

// messageオブジェクトを作成する
function createMessages({ accountName, webPropertyName, profileName, report }) {
  const header = ['ページビュー', 'セッション', '平均セッション時間', '離脱率'];
  const diplayText = report.reduce((text, r) => {
    const [path, title, ...indexes] = r;

    const t = indexes.reduce((indexesText, index, i) => {
      return indexesText + '\n\t' + header[i] + ': ' + index;
    }, `path: ${path}\n${title}`);
    return text + t + '\n\n';
  }, "Analytics Report\n\n");
  console.log(diplayText);
  return [{ "type": "text", "text": diplayText }];
}

/**
 * account内すべてのサイト情報を取得する
 * @return {array{}}
 */
function getLists() {
  const accounts = Analytics.Management.Accounts.list();
  if (!accounts.items || !accounts.items.length) return;
  const listReports = accounts.items.reduce((a, account) => {
    const accountId = account.id;
    const accountName = account.name;
    const webProperties = Analytics.Management.Webproperties.list(accountId);
    if (!webProperties.items || !webProperties.items.length) return a;
    const listProfiles = webProperties.items.reduce((b, webProperty) => {
      const webPropertyId = webProperty.id;
      const webPropertyName = webProperty.name;
      const profiles = Analytics.Management.Profiles.list(accountId, webPropertyId);
      if (!profiles.items || !profiles.items.length) return b;
      const reports = profiles.items.reduce((c, profile) => {
        const profileId = profile.id;
        const profileName = profile.name;
        const report = runReport(profileId);
        return [...c, { accountName, webPropertyName, profileName, report }];
      }, []);
      return [...b, ...reports];
    }, []);
    return [...a, ...listProfiles];
  }, []);

  console.log(listReports);
  return listReports;
} // const getWebproperty = (accountId) => {


//サイトのidからレポートを取得する
function runReport(id) {
  const tableId = 'ga:' + id;
  const today = new Date();
  const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);
  const date =  Utilities.formatDate(yesterday, Session.getScriptTimeZone(), 'yyyy-MM-dd');
  // const twodaysago = new Date(today.getTime() -2 *24 * 60 * 60 * 1000);
  // const startDate = Utilities.formatDate(yesterday, Session.getScriptTimeZone(), 'yyyy-MM-dd');
  // const endDate = Utilities.formatDate(yesterday, Session.getScriptTimeZone(), 'yyyy-MM-dd');
  const metric = 'ga:pageviews,ga:sessions,ga:avgSessionDuration,ga:bounceRate';
  const options = {
    'dimensions': 'ga:pagePath,ga:pageTitle',
    'sort': '-ga:pageviews',
    'max-results': 10
  };
  const report = Analytics.Data.Ga.get(tableId, date, date, metric, options);
  return report.rows;
}
