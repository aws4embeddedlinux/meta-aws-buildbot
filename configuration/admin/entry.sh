#!/bin/bash

export $(xargs < envfile)
cat envfile

cat admin.cfg > master.cfg
cat userconfiguration/user.cfg >> master.cfg

ls -la /mount/data/*
buildbot upgrade-master /home/user
buildbot start .
tail -f twistd.log
