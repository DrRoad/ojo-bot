#!/usr/bin/env python
#
# Created on 9/27/2012 Pat Cappelaere - Vightel Corporation
#
import sys, os, inspect, math

# Amazon S3
# import boto
import boto3
import uuid
import os, datetime, glob, shutil
from boto.s3.connection import S3Connection
from datetime import timedelta

# Site configuration
import config
import argparse

force			= 0
verbose			= 0

all_buckets 	= ["ojo-d2", "ojo-d3", "ojo-d4", "ojo-d5", "ojo-d6", "ojo-d7", "ojo-d8", "ojo-d9", "ojo-d10", "ojo-r01", "ojo-r02", "ojo-r03", "ojo-r04", "ojo-r05", "ojo-r06", "ojo-r07", "ojo-r08", "ojo-r09", "ojo-r10", "ojo-global"]
imerg_buckets 	= ["ojo-r01", "ojo-r02", "ojo-r03", "ojo-r04", "ojo-r05", "ojo-r06", "ojo-r07", "ojo-r08", "ojo-r09", "ojo-r10"]

dirs2			= ["trmm"]

dirs	= [	"ant_r/d02",
			"ant_r/d03",
			"ant_r/d07",
			"ant_r/d08",
			"ant_r/d09",
			"ant_r/d10",
			"geos5",
			"gfms",
			"gpm",
			"gpm_1d",
			"gpm_3d",
			"gpm_3hrs",
			"gpm_7d",
			"gpm_30mn",
			"global_landslide_nowcast",
			"landslide_nowcast/d02",
			"landslide_nowcast/d03",
			"landslide_nowcast/d07",
			"landslide_nowcast/d08",
			"landslide_nowcast/d09",
			"landslide_nowcast/d10",
			"modis_af",
			"modis_burned_areas",
			"quakes",
			"trmm",
			"trmm/3B42RT",
			"trmm/d02",
			"trmm/d03",
			"viirs_chla"
		]

#
# Only keep seven days of these folders
#
daily_dirs = [
	"gpm_30mn",
	"gpm_30mn_1d",
	"gpm_30mn_3hr"
]

def names(x):
	return x.name
			
def manage_bucket(b, product, dl):
	s3 			= boto3.resource('s3')
	print "** managing bucket:", b
	bucket 		= s3.Bucket(b)
	for obj in bucket.objects.filter(Prefix=product+"/"):
		dt 		= obj.last_modified
		name	= obj.key
		
		if (dt.date() < dl):
			msg = "** delete **"
			print b, name, key.size, dt, msg
			obj.delete()
		
			
def manage_folder(f, dl):
	basename = os.path.basename(f)
	if len(basename)==8:
		year 	= int(basename[0:4])
		month	= int(basename[4:6])
		day		= int(basename[6:8])
		dt		= datetime.date(year,month,day)
		
		msg = ""
		if dt < dl:
			msg = "** delete "+f
			print basename, year, month, day, msg
			shutil.rmtree(f)
		
def manage_local_dirs(dl, data_dir):
	for d in buckets:
		folder 	= os.path.join(data_dir, d)
		print folder
		lst 	= glob.glob(folder+'/[0-9]*')
		for l in lst:
			manage_folder(l, dl)

def manage_daily_dirs(dl, data_dir):
	for d in daily_dirs:
		folder 	= os.path.join(data_dir, d)
		print folder
		lst 	= glob.glob(folder+'/[0-9]*')
		for l in lst:
			manage_folder(l, dl)
		
#
# ======================================================================
# Only keep AWS keys in buckets that are less than 90 days old
#
if __name__ == '__main__':
	
	parser 		= argparse.ArgumentParser(description='AWS Mange')
	apg_input 	= parser.add_argument_group('Input')
	
	apg_input.add_argument("-f", "--force",   action='store_true', help="force it")
	apg_input.add_argument("-v", "--verbose", action='store_true', help="Verbose Flag")
	
	options 	= parser.parse_args()
	
	force		= options.force
	verbose		= options.verbose
	
	if config.USING_AWS_S3_FOR_STORAGE:
		aws_access_key 			= os.environ.get('AWS_ACCESSKEYID')
		aws_secret_access_key 	= os.environ.get('AWS_SECRETACCESSKEY')
	
		#conn 	= S3Connection(aws_access_key, aws_secret_access_key)
	
		s3 		= boto3.client('s3', 
				aws_access_key_id		= os.environ.get('AWS_ACCESSKEYID'),
				aws_secret_access_key 	= os.environ.get('AWS_SECRETACCESSKEY')
		)
		
	today 	= datetime.date.today()
	
	# manage daily products (60 days)
	manage_local_dirs(today - timedelta(days= config.DAYS_KEEP), config.DATA_DIR )
	
	# manage 30mn products (7 days)
	manage_daily_dirs(today - timedelta(days= 7), config.DATA_DIR )
	
	if config.USING_AWS_S3_FOR_STORAGE:
		dl = today - timedelta(days= config.DAYS_KEEP)
		for b in all_buckets:
			for d in dirs
				manage_bucket(b, d, dl)
		
		# Manage IMERG 30mn product buckets for 7 days
		dl = today - timedelta(days= 7)
		for b in imerg_buckets:
			for d in daily_dirs:
				manage_bucket(b, d, dl)

	
	