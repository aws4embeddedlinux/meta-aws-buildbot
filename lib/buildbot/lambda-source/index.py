import json, urllib.request, urllib.error

def strip_in_headers(headers):
    return headers

def lambda_handler(event, context):
  print(json.dumps(event))

  url = "http://buildbot.service:8010/change_hook/github"

  try:
      data = event['body'].encode()
      
      print("construct http request")
      req = urllib.request.Request(url, data=data)
      if 'headers' in event and isinstance(event['headers'], dict) and len(event['headers']) > 0:
        for incoming_header in strip_in_headers(event['headers']):
            req.add_header(incoming_header, event['headers'][incoming_header])
      
      buildbot_response = urllib.request.urlopen(req)
      
      print("buildbot_response:" + buildbot_response.read().decode())
      buildbot_response = {
        "statusCode": buildbot_response.status,
        "body": "OK",
      }
      
  except urllib.error.HTTPError as e:
      buildbot_response = {
        "statusCode": 400,
        "body": "ERROR",
      }
      print("exception handler:")
      print(e)
      
  print("sending response to GitHub")
  return buildbot_response
