Setting up:

* Deploy source bucket and pipeline then use the bucket name below.

```
# Zip the needed files.
zip -o config.zip buildspec.yml Dockerfile entry.sh master.cfg

# S3 CP to the config key.
aws --profile PROFILE s3 cp config.zip s3://BUCKET/config
```

Running locally:
```
docker build -t buildbot:latest .

# Does not include worker port, found in the master.cfg
docker run -p 8010:8010 buildbot:latest
```

Development Setup
```
python3 -m venv venv
. ./venv/bin/activate
pip install -r dev-requirements.txt
```

