FROM public.ecr.aws/lts/ubuntu:22.04_stable

RUN apt-get update && apt-get install -y build-essential python3-dev libssl-dev \
    libffi-dev python3-pip python3-venv git 

# DEBUG
RUN apt-get install -y psmisc vim lsof nmap iputils-ping curl
# DEBUG

RUN useradd -U -m user

USER user
WORKDIR /home/user

EXPOSE 8010
EXPOSE 9989

RUN python3 -m pip install --upgrade pip
RUN python3 -m pip install boto3 botocore
RUN python3 -m pip install git-remote-codecommit
RUN python3 -m pip install 'buildbot[bundle]'

ENV PATH="/home/user/.local/bin:${PATH}"

RUN buildbot create-master .
COPY admin.cfg .
COPY envfile .
COPY entry.sh .
RUN mkdir userconfig
RUN chown -R user: userconfiguration/
COPY user.cfg userconfiguration/

ENTRYPOINT [ "./entry.sh" ]
